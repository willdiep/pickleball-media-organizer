use std::fs::File;
use std::io::{Read, Seek, SeekFrom, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// Fixed loopback port. WebKitGTK plays `file://` and `http://` video, but its
/// media pipeline does not load Tauri's `asset://` custom protocol (images do).
/// The port is pinned so the production CSP can name it.
pub const PORT: u16 = 17421;
pub const ORIGIN: &str = "http://127.0.0.1:17421";

#[derive(Clone)]
pub struct MediaServer {
    allowed: Arc<Mutex<Vec<PathBuf>>>,
}

impl MediaServer {
    pub fn allow_directory(&self, directory: &Path) {
        let Ok(canonical) = directory.canonicalize() else {
            return;
        };
        if !canonical.is_dir() {
            return;
        }
        let mut allowed = self.allowed.lock().expect("media allow list");
        if !allowed.iter().any(|dir| dir == &canonical) {
            allowed.push(canonical);
        }
    }
}

pub fn start() -> std::io::Result<MediaServer> {
    let listener = TcpListener::bind(("127.0.0.1", PORT))?;
    let allowed = Arc::new(Mutex::new(Vec::new()));
    spawn(listener, allowed.clone());
    log::info!("media server listening on {ORIGIN}");
    Ok(MediaServer { allowed })
}

fn spawn(listener: TcpListener, allowed: Arc<Mutex<Vec<PathBuf>>>) {
    std::thread::Builder::new()
        .name("media-server".into())
        .spawn(move || {
            for incoming in listener.incoming() {
                let Ok(stream) = incoming else {
                    continue;
                };
                let allowed = allowed.clone();
                std::thread::spawn(move || {
                    if let Err(err) = handle_connection(stream, &allowed) {
                        log::debug!("media server connection closed: {err}");
                    }
                });
            }
        })
        .expect("media server thread");
}

fn handle_connection(
    mut stream: TcpStream,
    allowed: &Mutex<Vec<PathBuf>>,
) -> std::io::Result<()> {
    stream.set_read_timeout(Some(Duration::from_secs(10)))?;
    stream.set_write_timeout(Some(Duration::from_secs(60)))?;

    let mut buffer = [0_u8; 8192];
    let read = stream.read(&mut buffer)?;
    let request = String::from_utf8_lossy(&buffer[..read]);
    let mut lines = request.split("\r\n");
    let Some(request_line) = lines.next() else {
        return write_status(&mut stream, 400, "Bad Request", None);
    };
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or("");
    let target = parts.next().unwrap_or("");

    if method == "OPTIONS" {
        return write_status(&mut stream, 204, "No Content", None);
    }
    if method != "GET" && method != "HEAD" {
        return write_status(&mut stream, 405, "Method Not Allowed", None);
    }

    let Some(filepath) = media_path(target) else {
        return write_status(&mut stream, 404, "Not Found", None);
    };

    let allowed_dirs = allowed.lock().expect("media allow list").clone();
    let Some(file_path) = allowed_file(Path::new(&filepath), &allowed_dirs) else {
        log::warn!("media server denied {filepath}");
        return write_status(&mut stream, 403, "Forbidden", None);
    };

    let mut file = File::open(&file_path)?;
    let len = file.metadata()?.len();
    let mime = content_type(&file_path);
    let range_header = lines.find_map(|line| {
        let (name, value) = line.split_once(':')?;
        if name.eq_ignore_ascii_case("range") {
            Some(value.trim().to_string())
        } else {
            None
        }
    });

    let (status, start, end) = if let Some(header) = range_header {
        match parse_byte_range(&header, len) {
            Some((start, end)) => (206, start, end),
            None => return write_range_not_satisfiable(&mut stream, len),
        }
    } else if len == 0 {
        (200, 0, 0)
    } else {
        (200, 0, len - 1)
    };

    let body_len = if len == 0 { 0 } else { end - start + 1 };
    let mut header = format!(
        "HTTP/1.1 {status} {}\r\nContent-Type: {mime}\r\nContent-Length: {body_len}\r\nAccept-Ranges: bytes\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: Range\r\nAccess-Control-Expose-Headers: Content-Range, Accept-Ranges, Content-Length\r\n",
        if status == 206 { "Partial Content" } else { "OK" }
    );
    if status == 206 {
        header.push_str(&format!("Content-Range: bytes {start}-{end}/{len}\r\n"));
    }
    header.push_str("\r\n");
    stream.write_all(header.as_bytes())?;
    if method == "HEAD" || body_len == 0 {
        return Ok(());
    }

    file.seek(SeekFrom::Start(start))?;
    let mut remaining = body_len;
    let mut chunk = [0_u8; 64 * 1024];
    while remaining > 0 {
        let want = remaining.min(chunk.len() as u64) as usize;
        let read = file.read(&mut chunk[..want])?;
        if read == 0 {
            break;
        }
        stream.write_all(&chunk[..read])?;
        remaining -= read as u64;
    }
    Ok(())
}

fn media_path(target: &str) -> Option<String> {
    let (path, query) = target.split_once('?').unwrap_or((target, ""));
    if path != "/media" {
        return None;
    }
    for pair in query.split('&') {
        let (key, value) = pair.split_once('=')?;
        if key == "path" {
            let decoded = percent_decode(value);
            if decoded.is_empty() {
                return None;
            }
            return Some(decoded);
        }
    }
    None
}

fn allowed_file(path: &Path, allowed_dirs: &[PathBuf]) -> Option<PathBuf> {
    let canonical = path.canonicalize().ok()?;
    if !canonical.is_file() {
        return None;
    }
    let permitted = allowed_dirs.iter().any(|dir| canonical.starts_with(dir));
    if permitted { Some(canonical) } else { None }
}

fn content_type(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "webm" => "video/webm",
        "mov" | "m4v" => "video/quicktime",
        "avi" => "video/x-msvideo",
        "mp4" => "video/mp4",
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        _ => "application/octet-stream",
    }
}

fn parse_byte_range(header: &str, len: u64) -> Option<(u64, u64)> {
    let value = header.trim().strip_prefix("bytes=")?;
    if value.contains(',') || len == 0 {
        return None;
    }
    let (start, end) = value.split_once('-')?;
    if start.is_empty() {
        let suffix: u64 = end.parse().ok()?;
        if suffix == 0 {
            return None;
        }
        let suffix = suffix.min(len);
        Some((len - suffix, len - 1))
    } else {
        let start: u64 = start.parse().ok()?;
        if start >= len {
            return None;
        }
        let end = if end.is_empty() {
            len - 1
        } else {
            end.parse::<u64>().ok()?.min(len - 1)
        };
        if end < start {
            return None;
        }
        Some((start, end))
    }
}

fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            if let Ok(byte) = u8::from_str_radix(
                std::str::from_utf8(&bytes[index + 1..index + 3]).unwrap_or(""),
                16,
            ) {
                out.push(byte);
                index += 3;
                continue;
            }
        }
        out.push(bytes[index]);
        index += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn write_status(
    stream: &mut TcpStream,
    status: u16,
    reason: &str,
    extra: Option<&str>,
) -> std::io::Result<()> {
    let extra = extra.unwrap_or("");
    let body = reason.as_bytes();
    let response = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: text/plain\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: Range\r\n{extra}\r\n",
        body.len()
    );
    stream.write_all(response.as_bytes())?;
    stream.write_all(body)?;
    Ok(())
}

fn write_range_not_satisfiable(stream: &mut TcpStream, len: u64) -> std::io::Result<()> {
    let response = format!(
        "HTTP/1.1 416 Range Not Satisfiable\r\nContent-Range: bytes */{len}\r\nContent-Length: 0\r\nAccess-Control-Allow-Origin: *\r\n\r\n"
    );
    stream.write_all(response.as_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

    #[test]
    fn decodes_percent_encoded_paths() {
        assert_eq!(
            percent_decode("%2Ftmp%2Fblue%20clip.mp4"),
            "/tmp/blue clip.mp4"
        );
    }

    #[test]
    fn parses_open_and_suffix_ranges() {
        assert_eq!(parse_byte_range("bytes=0-", 10), Some((0, 9)));
        assert_eq!(parse_byte_range("bytes=2-5", 10), Some((2, 5)));
        assert_eq!(parse_byte_range("bytes=-3", 10), Some((7, 9)));
        assert!(parse_byte_range("bytes=10-", 10).is_none());
    }

    #[test]
    fn serves_an_allowed_file_with_range_and_rejects_others() {
        let dir = std::env::temp_dir().join(format!("pickleball-media-server-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file_path = dir.join("clip.mp4");
        std::fs::write(&file_path, b"0123456789abcdef").unwrap();
        let secret = std::env::temp_dir().join(format!("pickleball-secret-{}", std::process::id()));
        std::fs::write(&secret, b"secret").unwrap();

        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let allowed = Arc::new(Mutex::new(Vec::new()));
        let server = MediaServer {
            allowed: allowed.clone(),
        };
        server.allow_directory(&dir);
        spawn(listener, allowed);

        let url = format!(
            "http://127.0.0.1:{port}/media?path={}",
            percent_encode(&file_path.to_string_lossy())
        );
        let full = http_get(&url, None);
        assert!(full.starts_with("HTTP/1.1 200"));
        assert!(full.contains("Content-Type: video/mp4"));
        assert!(full.ends_with("0123456789abcdef"));

        let partial = http_get(&url, Some("bytes=4-7"));
        assert!(partial.contains("HTTP/1.1 206"));
        assert!(partial.contains("Content-Range: bytes 4-7/16"));
        assert!(partial.ends_with("4567"));

        let denied = http_get(
            &format!(
                "http://127.0.0.1:{port}/media?path={}",
                percent_encode(&secret.to_string_lossy())
            ),
            None,
        );
        assert!(denied.starts_with("HTTP/1.1 403"));

        let _ = std::fs::remove_dir_all(&dir);
        let _ = std::fs::remove_file(&secret);
    }

    fn percent_encode(value: &str) -> String {
        let mut out = String::new();
        for byte in value.bytes() {
            match byte {
                b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    out.push(byte as char);
                }
                _ => out.push_str(&format!("%{byte:02X}")),
            }
        }
        out
    }

    fn http_get(url: &str, range: Option<&str>) -> String {
        let rest = url.trim_start_matches("http://");
        let (host, path) = rest.split_once('/').unwrap();
        let mut stream = TcpStream::connect(host).unwrap();
        let range_header = range
            .map(|value| format!("Range: {value}\r\n"))
            .unwrap_or_default();
        stream
            .write_all(format!("GET /{path} HTTP/1.1\r\nHost: {host}\r\n{range_header}\r\n").as_bytes())
            .unwrap();
        let mut response = String::new();
        stream.read_to_string(&mut response).unwrap();
        response
    }
}
