use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::types::ValueRef;
use rusqlite::{Connection, OptionalExtension, Row, params};
use serde::Serialize;
use uuid::Uuid;
use walkdir::WalkDir;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TagRecord {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaRecord {
    pub id: i64,
    pub uuid: String,
    pub filename: String,
    pub filepath: String,
    pub mediatype: String,
    pub description: Option<String>,
    pub group_path: Option<String>,
    pub category: String,
    pub root_id: Option<i64>,
    pub file_modified_at: Option<String>,
    pub file_missing: bool,
    pub preview_path: Option<String>,
    pub preview_unavailable: bool,
    pub created_at: String,
    pub updated_at: String,
    pub tags: Vec<TagRecord>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryPayload {
    pub media: Vec<MediaRecord>,
    pub tags: Vec<TagRecord>,
    pub roots: Vec<RootRecord>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestPayload {
    pub imported: i64,
    pub already_present: i64,
    pub skipped: i64,
    pub media: Vec<MediaRecord>,
    pub tags: Vec<TagRecord>,
    pub roots: Vec<RootRecord>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RootRecord {
    pub id: i64,
    pub path: String,
    pub media_count: i64,
}

#[derive(Debug)]
pub struct IngestOutcome {
    pub imported: i64,
    pub already_present: i64,
    pub skipped: i64,
    pub root_id: i64,
    pub seen: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RescanOutcome {
    pub imported: i64,
    pub already_present: i64,
    pub skipped: i64,
    pub missing: i64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestProgress {
    pub scanned: u64,
    pub imported: u64,
    pub already_present: u64,
    pub skipped: u64,
}

pub fn database_file() -> PathBuf {
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let root = if cwd.join("src-tauri").is_dir() {
        cwd
    } else if cwd.file_name().and_then(|name| name.to_str()) == Some("src-tauri") {
        cwd.join("..")
    } else {
        cwd
    };
    let dir = root.join("data");
    fs::create_dir_all(&dir).ok();
    dir.join("pickleball.db")
}

pub fn open_database() -> rusqlite::Result<Connection> {
    let path = database_file();
    let conn = Connection::open(path)?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    ensure_schema(&conn)?;
    Ok(conn)
}

pub fn ensure_schema(conn: &Connection) -> rusqlite::Result<()> {
    let media_exists: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'Media'",
        [],
        |row| row.get(0),
    )?;
    if media_exists == 0 {
        conn.execute_batch(include_str!("../migrations/001_init.sql"))?;
    }

    let description_exists: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('Media') WHERE name = 'description'",
        [],
        |row| row.get(0),
    )?;
    if description_exists == 0 {
        conn.execute_batch(include_str!("../migrations/002_description.sql"))?;
    }

    let group_path_exists: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('Media') WHERE name = 'group_path'",
        [],
        |row| row.get(0),
    )?;
    if group_path_exists == 0 {
        conn.execute_batch(include_str!("../migrations/003_group_path.sql"))?;
    }

    let category_exists: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('Media') WHERE name = 'category'",
        [],
        |row| row.get(0),
    )?;
    if category_exists == 0 {
        conn.execute_batch(include_str!("../migrations/004_category.sql"))?;
    }

    let root_table_exists: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'LibraryRoot'",
        [],
        |row| row.get(0),
    )?;
    if root_table_exists == 0 {
        conn.execute_batch(include_str!("../migrations/005_library_root.sql"))?;
    }
    Ok(())
}

pub fn list_library(conn: &Connection) -> rusqlite::Result<LibraryPayload> {
    Ok(LibraryPayload {
        media: load_media(conn)?,
        tags: load_tags(conn)?,
        roots: list_roots(conn)?,
    })
}

pub fn get_media(conn: &Connection, media_id: i64) -> rusqlite::Result<Option<MediaRecord>> {
    let mut media = load_media(conn)?;
    Ok(media.drain(..).find(|item| item.id == media_id))
}

pub fn list_tags(conn: &Connection) -> rusqlite::Result<Vec<TagRecord>> {
    load_tags(conn)
}

pub fn update_tags(
    conn: &Connection,
    media_id: i64,
    tags: Vec<String>,
) -> rusqlite::Result<LibraryPayload> {
    let mut names = Vec::new();
    for tag in tags {
        let name = tag.trim().to_lowercase();
        if name.is_empty() || names.contains(&name) {
            continue;
        }
        names.push(name);
    }

    let tx = conn.unchecked_transaction()?;
    for name in &names {
        tx.execute(
            "INSERT INTO Tag (name) VALUES (?1) ON CONFLICT(name) DO NOTHING",
            [name],
        )?;
    }
    tx.execute("DELETE FROM MediaTag WHERE mediaId = ?1", [media_id])?;
    for name in &names {
        let tag_id: i64 = tx.query_row("SELECT id FROM Tag WHERE name = ?1", [name], |row| {
            row.get(0)
        })?;
        tx.execute(
            "INSERT INTO MediaTag (mediaId, tagId) VALUES (?1, ?2)",
            params![media_id, tag_id],
        )?;
    }
    tx.execute(
        "UPDATE Media SET updated_at = datetime('now') WHERE id = ?1",
        [media_id],
    )?;
    tx.commit()?;
    list_library(conn)
}

pub fn update_description(
    conn: &Connection,
    media_id: i64,
    description: String,
) -> rusqlite::Result<Option<MediaRecord>> {
    let trimmed = description.trim();
    let value: Option<&str> = if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    };
    conn.execute(
        "UPDATE Media SET description = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![value, media_id],
    )?;
    get_media(conn, media_id)
}

pub fn delete_media(conn: &Connection, media_id: i64) -> rusqlite::Result<LibraryPayload> {
    let tx = conn.unchecked_transaction()?;
    tx.execute("DELETE FROM MediaTag WHERE mediaId = ?1", [media_id])?;
    tx.execute("DELETE FROM Media WHERE id = ?1", [media_id])?;
    tx.commit()?;
    list_library(conn)
}

pub fn delete_all_media(conn: &Connection) -> rusqlite::Result<LibraryPayload> {
    let tx = conn.unchecked_transaction()?;
    tx.execute("DELETE FROM MediaTag", [])?;
    tx.execute("DELETE FROM Media", [])?;
    tx.execute("DELETE FROM Tag", [])?;
    tx.execute("DELETE FROM LibraryRoot", [])?;
    tx.commit()?;
    list_library(conn)
}

pub fn ingest_directory(
    conn: &Connection,
    directory: &Path,
    category: &str,
    mut on_progress: impl FnMut(IngestProgress),
) -> rusqlite::Result<IngestOutcome> {
    if !directory.is_dir() {
        return Err(rusqlite::Error::InvalidParameterName(format!(
            "Not a directory: {}",
            directory.display()
        )));
    }
    let category = require_category(category)?;

    let canonical = fs::canonicalize(directory).unwrap_or_else(|_| directory.to_path_buf());
    let mut imported = 0_i64;
    let mut already_present = 0_i64;
    let mut skipped = 0_i64;
    let mut scanned = 0_u64;
    let mut seen = Vec::new();
    let tx = conn.unchecked_transaction()?;
    let root_id = upsert_root(&tx, &canonical)?;
    for entry in WalkDir::new(&canonical).into_iter().filter_map(Result::ok) {
        if !entry.file_type().is_file() {
            continue;
        }
        scanned += 1;
        let path = entry.path();
        let Some(mediatype) = infer_media_type(path) else {
            skipped += 1;
            report_scan(
                &mut on_progress,
                scanned,
                imported,
                already_present,
                skipped,
            );
            continue;
        };
        let Some(filename) = path.file_name().and_then(|name| name.to_str()) else {
            skipped += 1;
            report_scan(
                &mut on_progress,
                scanned,
                imported,
                already_present,
                skipped,
            );
            continue;
        };
        let filepath = path.to_string_lossy().to_string();
        let existing_uuid: Option<String> = tx
            .query_row(
                "SELECT uuid FROM Media WHERE filepath = ?1",
                [&filepath],
                |row| row.get(0),
            )
            .optional()?;
        let existed = existing_uuid.is_some();
        let uuid = existing_uuid.unwrap_or_else(|| Uuid::new_v4().to_string());
        if is_heif(path) {
            write_heic_preview(path, &uuid);
        }
        let group_path =
            group_path_for(&canonical, path).map(|group| group.to_string_lossy().into_owned());
        let modified = file_modified_stamp(path);
        tx.execute(
            "INSERT INTO Media (uuid, filename, filepath, mediatype, group_path, category, root_id, file_modified_at, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'), datetime('now'))
             ON CONFLICT(filepath) DO UPDATE SET
               group_path = excluded.group_path,
               category = excluded.category,
               root_id = excluded.root_id,
               file_modified_at = excluded.file_modified_at",
            params![
                uuid,
                filename,
                filepath,
                mediatype,
                group_path,
                category,
                root_id,
                modified
            ],
        )?;
        // A conflicting filepath keeps its tags, description, uuid, and created_at.
        // group_path, category, folder, and file time are refreshed.
        seen.push(filepath);
        if existed {
            already_present += 1;
        } else {
            imported += 1;
        }
        report_scan(
            &mut on_progress,
            scanned,
            imported,
            already_present,
            skipped,
        );
    }
    tx.commit()?;
    on_progress(IngestProgress {
        scanned,
        imported: imported as u64,
        already_present: already_present as u64,
        skipped: skipped as u64,
    });
    Ok(IngestOutcome {
        imported,
        already_present,
        skipped,
        root_id,
        seen,
    })
}

pub fn list_roots(conn: &Connection) -> rusqlite::Result<Vec<RootRecord>> {
    let mut stmt = conn.prepare(
        "SELECT r.id, r.path, COUNT(m.id)
         FROM LibraryRoot r
         LEFT JOIN Media m ON m.root_id = r.id
         GROUP BY r.id
         ORDER BY r.path ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(RootRecord {
            id: row.get(0)?,
            path: row.get(1)?,
            media_count: row.get(2)?,
        })
    })?;
    rows.collect()
}

pub fn rescan_root(
    conn: &Connection,
    root_id: i64,
    on_progress: impl FnMut(IngestProgress),
) -> rusqlite::Result<RescanOutcome> {
    let path: String = conn.query_row(
        "SELECT path FROM LibraryRoot WHERE id = ?1",
        [root_id],
        |row| row.get(0),
    )?;
    let category: String = conn
        .query_row(
            "SELECT category FROM Media WHERE root_id = ?1 LIMIT 1",
            [root_id],
            |row| row.get(0),
        )
        .optional()?
        .unwrap_or_else(|| "pickleball".to_string());
    let outcome = ingest_directory(conn, Path::new(&path), &category, on_progress)?;
    let missing = count_missing(conn, outcome.root_id, &outcome.seen)?;
    Ok(RescanOutcome {
        imported: outcome.imported,
        already_present: outcome.already_present,
        skipped: outcome.skipped,
        missing,
    })
}

pub fn remove_root(conn: &Connection, root_id: i64) -> rusqlite::Result<LibraryPayload> {
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "DELETE FROM MediaTag WHERE mediaId IN (SELECT id FROM Media WHERE root_id = ?1)",
        [root_id],
    )?;
    tx.execute("DELETE FROM Media WHERE root_id = ?1", [root_id])?;
    tx.execute(
        "DELETE FROM Tag WHERE id NOT IN (SELECT tagId FROM MediaTag)",
        [],
    )?;
    tx.execute("DELETE FROM LibraryRoot WHERE id = ?1", [root_id])?;
    tx.commit()?;
    list_library(conn)
}

pub fn media_filepath(conn: &Connection, media_id: i64) -> rusqlite::Result<Option<String>> {
    conn.query_row(
        "SELECT filepath FROM Media WHERE id = ?1",
        [media_id],
        |row| row.get(0),
    )
    .optional()
}

fn upsert_root(conn: &Connection, directory: &Path) -> rusqlite::Result<i64> {
    let path = directory.to_string_lossy().to_string();
    conn.execute(
        "INSERT INTO LibraryRoot (path) VALUES (?1) ON CONFLICT(path) DO NOTHING",
        [&path],
    )?;
    conn.query_row(
        "SELECT id FROM LibraryRoot WHERE path = ?1",
        [&path],
        |row| row.get(0),
    )
}

fn count_missing(conn: &Connection, root_id: i64, seen: &[String]) -> rusqlite::Result<i64> {
    conn.execute(
        "CREATE TEMP TABLE IF NOT EXISTS ingest_seen (path TEXT PRIMARY KEY)",
        [],
    )?;
    conn.execute("DELETE FROM ingest_seen", [])?;
    for path in seen {
        conn.execute("INSERT INTO ingest_seen (path) VALUES (?1)", [path])?;
    }
    conn.query_row(
        "SELECT COUNT(*) FROM Media
         WHERE root_id = ?1
           AND filepath NOT IN (SELECT path FROM ingest_seen)",
        [root_id],
        |row| row.get(0),
    )
}

pub fn preview_directory() -> PathBuf {
    let dir = database_file()
        .parent()
        .unwrap_or(Path::new("."))
        .join("previews");
    let _ = fs::create_dir_all(&dir);
    dir
}

fn preview_path_for(uuid: &str) -> PathBuf {
    preview_directory().join(format!("{uuid}.jpg"))
}

fn write_heic_preview(source: &Path, uuid: &str) {
    let dest = preview_path_for(uuid);
    if dest.is_file() {
        return;
    }
    if let Some(parent) = dest.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if !run_converter("heif-convert", source, &dest) {
        let _ = fs::remove_file(&dest);
    }
}

fn run_converter(program: &str, source: &Path, dest: &Path) -> bool {
    let Ok(status) = std::process::Command::new(program)
        .arg(source)
        .arg(dest)
        .status()
    else {
        return false;
    };
    status.success() && dest.is_file()
}

fn file_modified_stamp(path: &Path) -> Option<String> {
    let modified = fs::metadata(path).ok()?.modified().ok()?;
    let secs = modified
        .duration_since(std::time::UNIX_EPOCH)
        .ok()?
        .as_secs();
    Some(format_unix_utc(secs))
}

fn format_unix_utc(secs: u64) -> String {
    let days = (secs / 86_400) as i64;
    let tod = secs % 86_400;
    let hour = tod / 3600;
    let minute = (tod % 3600) / 60;
    let second = tod % 60;
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let year_of_era = yoe as i64;
    let y = year_of_era + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if month <= 2 { y + 1 } else { y };
    format!("{year:04}-{month:02}-{day:02} {hour:02}:{minute:02}:{second:02}")
}

fn report_scan(
    on_progress: &mut impl FnMut(IngestProgress),
    scanned: u64,
    imported: i64,
    already_present: i64,
    skipped: i64,
) {
    if scanned % 25 != 0 {
        return;
    }
    on_progress(IngestProgress {
        scanned,
        imported: imported as u64,
        already_present: already_present as u64,
        skipped: skipped as u64,
    });
}

pub fn stored_directories(conn: &Connection) -> rusqlite::Result<Vec<PathBuf>> {
    let mut stmt = conn.prepare("SELECT filepath FROM Media")?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    let mut dirs = Vec::new();
    for row in rows {
        let filepath = row?;
        if let Some(parent) = Path::new(&filepath).parent() {
            if parent.as_os_str().is_empty() {
                continue;
            }
            if !dirs.iter().any(|dir: &PathBuf| dir == parent) {
                dirs.push(parent.to_path_buf());
            }
        }
    }
    Ok(dirs)
}

fn load_media(conn: &Connection) -> rusqlite::Result<Vec<MediaRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, uuid, filename, filepath, mediatype, description, created_at, updated_at, group_path, category, root_id, file_modified_at
         FROM Media
         ORDER BY
           CASE typeof(created_at)
             WHEN 'integer' THEN created_at
             WHEN 'real' THEN created_at
             ELSE CAST(strftime('%s', created_at) AS INTEGER) * 1000
           END DESC,
           id DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        let uuid: String = row.get(1)?;
        let filepath: String = row.get(3)?;
        let file_missing = !Path::new(&filepath).exists();
        let preview = preview_path_for(&uuid);
        let preview_path = preview
            .is_file()
            .then(|| preview.to_string_lossy().into_owned());
        let preview_unavailable =
            !file_missing && preview_path.is_none() && is_heif(Path::new(&filepath));
        Ok(MediaRecord {
            id: row.get(0)?,
            uuid,
            filename: row.get(2)?,
            filepath,
            mediatype: row.get(4)?,
            description: row.get(5)?,
            group_path: row.get(8)?,
            category: row.get(9)?,
            root_id: row.get(10)?,
            file_modified_at: row.get(11)?,
            file_missing,
            preview_path,
            preview_unavailable,
            created_at: read_timestamp(row, 6)?,
            updated_at: read_timestamp(row, 7)?,
            tags: Vec::new(),
        })
    })?;
    let mut media = Vec::new();
    for row in rows {
        media.push(row?);
    }

    let mut tag_stmt = conn.prepare(
        "SELECT t.id, t.name
         FROM MediaTag mt
         JOIN Tag t ON t.id = mt.tagId
         WHERE mt.mediaId = ?1
         ORDER BY t.name ASC",
    )?;
    for item in &mut media {
        let tags = tag_stmt.query_map([item.id], |row| {
            Ok(TagRecord {
                id: row.get(0)?,
                name: row.get(1)?,
            })
        })?;
        item.tags = tags.collect::<Result<Vec<_>, _>>()?;
    }
    Ok(media)
}

fn load_tags(conn: &Connection) -> rusqlite::Result<Vec<TagRecord>> {
    let mut stmt = conn.prepare("SELECT id, name FROM Tag ORDER BY name ASC")?;
    let rows = stmt.query_map([], |row| {
        Ok(TagRecord {
            id: row.get(0)?,
            name: row.get(1)?,
        })
    })?;
    rows.collect()
}

fn read_timestamp(row: &Row<'_>, index: usize) -> rusqlite::Result<String> {
    match row.get_ref(index)? {
        ValueRef::Text(bytes) => Ok(String::from_utf8_lossy(bytes).into_owned()),
        ValueRef::Integer(value) => Ok(value.to_string()),
        ValueRef::Real(value) => Ok(value.to_string()),
        ValueRef::Null => Ok(String::new()),
        ValueRef::Blob(_) => Ok(String::new()),
    }
}

/// Files directly in the imported root stay ungrouped. Everything under an
/// immediate child directory shares that directory, including nested files.
fn group_path_for(root: &Path, file: &Path) -> Option<PathBuf> {
    let canonical_root = fs::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
    let canonical_file = fs::canonicalize(file).unwrap_or_else(|_| file.to_path_buf());
    let relative = canonical_file.strip_prefix(&canonical_root).ok()?;
    let mut parts = relative.components();
    let first = parts.next()?;
    if parts.next().is_none() {
        return None;
    }
    match first {
        std::path::Component::Normal(_) => Some(canonical_root.join(first)),
        _ => None,
    }
}

fn require_category(category: &str) -> rusqlite::Result<&'static str> {
    match category {
        "pickleball" => Ok("pickleball"),
        "exercises" => Ok("exercises"),
        other => Err(rusqlite::Error::InvalidParameterName(format!(
            "Unknown category: {other}"
        ))),
    }
}

fn is_heif(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.to_ascii_lowercase())
            .as_deref(),
        Some("heic") | Some("heif")
    )
}

fn infer_media_type(path: &Path) -> Option<&'static str> {
    let ext = path.extension()?.to_str()?.to_ascii_lowercase();
    match ext.as_str() {
        "mp4" | "mov" | "m4v" | "webm" | "avi" => Some("VIDEO"),
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "heic" | "heif" => Some("PHOTO"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn delete_all_media_removes_media_links_and_tags() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        conn.execute_batch(include_str!("../migrations/001_init.sql"))
            .unwrap();
        conn.execute_batch(include_str!("../migrations/002_description.sql"))
            .unwrap();
        conn.execute_batch(include_str!("../migrations/003_group_path.sql"))
            .unwrap();
        conn.execute_batch(include_str!("../migrations/004_category.sql"))
            .unwrap();
        conn.execute_batch(include_str!("../migrations/005_library_root.sql"))
            .unwrap();
        conn.execute(
            "INSERT INTO Media (uuid, filename, filepath, mediatype, created_at, updated_at, description)
             VALUES ('id-1', 'rally.png', '/tmp/rally.png', 'PHOTO', datetime('now'), datetime('now'), 'note')",
            [],
        )
        .unwrap();
        conn.execute("INSERT INTO Tag (name) VALUES ('rally')", [])
            .unwrap();
        conn.execute("INSERT INTO MediaTag (mediaId, tagId) VALUES (1, 1)", [])
            .unwrap();
        conn.execute("INSERT INTO LibraryRoot (path) VALUES ('/tmp/library')", [])
            .unwrap();

        let library = delete_all_media(&conn).unwrap();
        assert!(library.media.is_empty());
        assert!(library.tags.is_empty());

        let media_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM Media", [], |row| row.get(0))
            .unwrap();
        let tag_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM Tag", [], |row| row.get(0))
            .unwrap();
        let link_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM MediaTag", [], |row| row.get(0))
            .unwrap();
        assert_eq!(media_count, 0);
        assert_eq!(tag_count, 0);
        assert_eq!(link_count, 0);
        let root_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM LibraryRoot", [], |row| row.get(0))
            .unwrap();
        assert_eq!(root_count, 0);
        assert!(library.roots.is_empty());
    }

    #[test]
    fn ingest_groups_subdirectory_media_and_leaves_root_files_alone() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        ensure_schema(&conn).unwrap();

        let root = std::env::temp_dir().join(format!("pickleball-group-{}", Uuid::new_v4()));
        let cleanup = root.clone();
        let _guard = scopeguard(&cleanup);
        fs::create_dir_all(root.join("rally-a").join("nested")).unwrap();
        fs::create_dir_all(root.join("rally-b")).unwrap();
        fs::write(root.join("loose.png"), b"png").unwrap();
        fs::write(root.join("notes.txt"), b"skip").unwrap();
        let a1 = root.join("rally-a").join("a1.png");
        fs::write(&a1, b"png").unwrap();
        fs::write(root.join("rally-a").join("nested").join("a2.png"), b"png").unwrap();
        fs::write(root.join("rally-b").join("b1.png"), b"png").unwrap();
        let stored_a1 = fs::canonicalize(&a1).unwrap();

        conn.execute(
            "INSERT INTO Media (uuid, filename, filepath, mediatype, description, group_path, created_at, updated_at)
             VALUES ('keep-a1', 'a1.png', ?1, 'PHOTO', 'keep me', NULL, datetime('now'), datetime('now'))",
            [stored_a1.to_string_lossy().to_string()],
        )
        .unwrap();

        let mut progress = Vec::new();
        let outcome =
            ingest_directory(&conn, &root, "pickleball", |event| progress.push(event)).unwrap();
        let imported = outcome.imported;
        let already_present = outcome.already_present;
        let skipped = outcome.skipped;
        assert_eq!(imported, 3);
        assert_eq!(already_present, 1);
        assert_eq!(skipped, 1);
        let last = progress.last().expect("final progress");
        assert_eq!(last.scanned, 5);
        assert_eq!(last.imported, 3);
        assert_eq!(last.already_present, 1);
        assert_eq!(last.skipped, 1);

        let media = load_media(&conn).unwrap();
        assert_eq!(media.len(), 4);
        let by_name = |filename: &str| {
            media
                .iter()
                .find(|item| item.filename == filename)
                .unwrap_or_else(|| panic!("missing {filename}"))
        };

        let rally_a = fs::canonicalize(root.join("rally-a"))
            .unwrap()
            .to_string_lossy()
            .into_owned();
        let rally_b = fs::canonicalize(root.join("rally-b"))
            .unwrap()
            .to_string_lossy()
            .into_owned();

        assert_eq!(by_name("loose.png").group_path, None);
        assert_eq!(
            by_name("a1.png").group_path.as_deref(),
            Some(rally_a.as_str())
        );
        assert_eq!(by_name("a1.png").description.as_deref(), Some("keep me"));
        assert_eq!(
            by_name("a2.png").group_path.as_deref(),
            Some(rally_a.as_str())
        );
        assert_eq!(
            by_name("b1.png").group_path.as_deref(),
            Some(rally_b.as_str())
        );
        assert!(media.iter().all(|item| item.filename != "notes.txt"));
        assert!(media.iter().all(|item| item.category == "pickleball"));

        let again_counts = ingest_directory(&conn, &root, "pickleball", |_| {}).unwrap();
        assert_eq!(again_counts.imported, 0);
        assert_eq!(again_counts.already_present, 4);
        assert_eq!(again_counts.skipped, 1);
        let again = load_media(&conn).unwrap();
        assert_eq!(again.len(), 4);
        assert_eq!(
            again
                .iter()
                .find(|item| item.filename == "a1.png")
                .unwrap()
                .description
                .as_deref(),
            Some("keep me")
        );
    }

    #[test]
    fn existing_media_defaults_to_pickleball() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        conn.execute_batch(include_str!("../migrations/001_init.sql"))
            .unwrap();
        conn.execute_batch(include_str!("../migrations/002_description.sql"))
            .unwrap();
        conn.execute_batch(include_str!("../migrations/003_group_path.sql"))
            .unwrap();
        conn.execute(
            "INSERT INTO Media (uuid, filename, filepath, mediatype, created_at, updated_at)
             VALUES ('id-1', 'rally.png', '/tmp/rally.png', 'PHOTO', datetime('now'), datetime('now'))",
            [],
        )
        .unwrap();

        ensure_schema(&conn).unwrap();
        let media = load_media(&conn).unwrap();
        assert_eq!(media.len(), 1);
        assert_eq!(media[0].category, "pickleball");
    }

    #[test]
    fn ingest_files_each_library_separately() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        ensure_schema(&conn).unwrap();

        let pickleball = std::env::temp_dir().join(format!("pickleball-lib-{}", Uuid::new_v4()));
        let exercises = std::env::temp_dir().join(format!("exercises-lib-{}", Uuid::new_v4()));
        let _pickleball_guard = scopeguard(&pickleball);
        let _exercises_guard = scopeguard(&exercises);
        fs::create_dir_all(&pickleball).unwrap();
        fs::create_dir_all(&exercises).unwrap();
        fs::write(pickleball.join("rally.png"), b"png").unwrap();
        let stretch = exercises.join("stretch.png");
        fs::write(&stretch, b"png").unwrap();
        let stored_stretch = fs::canonicalize(&stretch).unwrap();

        conn.execute(
            "INSERT INTO Media (uuid, filename, filepath, mediatype, description, category, created_at, updated_at)
             VALUES ('keep-stretch', 'stretch.png', ?1, 'PHOTO', 'keep me', 'exercises', datetime('now'), datetime('now'))",
            [stored_stretch.to_string_lossy().to_string()],
        )
        .unwrap();

        let pickleball_outcome =
            ingest_directory(&conn, &pickleball, "pickleball", |_| {}).unwrap();
        let exercises_outcome = ingest_directory(&conn, &exercises, "exercises", |_| {}).unwrap();
        assert_eq!(pickleball_outcome.imported, 1);
        assert_eq!(pickleball_outcome.already_present, 0);
        assert_eq!(exercises_outcome.imported, 0);
        assert_eq!(exercises_outcome.already_present, 1);

        let media = load_media(&conn).unwrap();
        assert_eq!(media.len(), 2);
        let by_name = |filename: &str| {
            media
                .iter()
                .find(|item| item.filename == filename)
                .unwrap_or_else(|| panic!("missing {filename}"))
        };
        assert_eq!(by_name("rally.png").category, "pickleball");
        assert_eq!(by_name("stretch.png").category, "exercises");
        assert_eq!(
            by_name("stretch.png").description.as_deref(),
            Some("keep me")
        );

        ingest_directory(&conn, &exercises, "pickleball", |_| {}).unwrap();
        let moved = load_media(&conn).unwrap();
        assert_eq!(moved.len(), 2);
        assert_eq!(
            moved
                .iter()
                .find(|item| item.filename == "stretch.png")
                .unwrap()
                .category,
            "pickleball"
        );
        assert_eq!(
            moved
                .iter()
                .find(|item| item.filename == "stretch.png")
                .unwrap()
                .description
                .as_deref(),
            Some("keep me")
        );

        let err = ingest_directory(&conn, &pickleball, "tennis", |_| {}).unwrap_err();
        assert!(err.to_string().contains("Unknown category"));
    }

    #[test]
    fn ingest_emits_progress_every_25_files() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        ensure_schema(&conn).unwrap();

        let root = std::env::temp_dir().join(format!("pickleball-progress-{}", Uuid::new_v4()));
        let cleanup = root.clone();
        let _guard = scopeguard(&cleanup);
        fs::create_dir_all(&root).unwrap();
        for index in 0..25 {
            fs::write(root.join(format!("clip-{index}.png")), b"png").unwrap();
        }
        fs::write(root.join("notes.txt"), b"skip").unwrap();

        let mut progress = Vec::new();
        let outcome =
            ingest_directory(&conn, &root, "pickleball", |event| progress.push(event)).unwrap();
        assert_eq!(outcome.imported, 25);
        assert_eq!(outcome.already_present, 0);
        assert_eq!(outcome.skipped, 1);
        assert!(
            progress.len() >= 2,
            "expected a mid-walk event and a final event, got {}",
            progress.len()
        );
        assert_eq!(progress[0].scanned, 25);
        let last = progress.last().unwrap();
        assert_eq!(last.scanned, 26);
        assert_eq!(last.imported, 25);
        assert_eq!(last.skipped, 1);
    }

    #[test]
    fn format_unix_utc_formats_a_known_instant() {
        assert_eq!(format_unix_utc(1_700_000_000), "2023-11-14 22:13:20");
    }

    #[test]
    fn ingest_tracks_root_file_time_rescan_and_removal() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        ensure_schema(&conn).unwrap();

        let root = std::env::temp_dir().join(format!("pickleball-root-{}", Uuid::new_v4()));
        let other = std::env::temp_dir().join(format!("pickleball-other-{}", Uuid::new_v4()));
        let _root_guard = scopeguard(&root);
        let _other_guard = scopeguard(&other);
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(&other).unwrap();

        let older = root.join("older.png");
        let newer = root.join("newer.png");
        fs::write(&older, b"png").unwrap();
        fs::write(&newer, b"png").unwrap();
        fs::File::open(&older)
            .unwrap()
            .set_modified(std::time::UNIX_EPOCH + std::time::Duration::from_secs(1_700_000_000))
            .unwrap();
        fs::File::open(&newer)
            .unwrap()
            .set_modified(std::time::UNIX_EPOCH + std::time::Duration::from_secs(1_800_000_000))
            .unwrap();
        fs::write(other.join("keep.png"), b"png").unwrap();

        let first = ingest_directory(&conn, &root, "pickleball", |_| {}).unwrap();
        assert_eq!(first.imported, 2);
        let roots = list_roots(&conn).unwrap();
        assert_eq!(roots.len(), 1);
        assert_eq!(roots[0].media_count, 2);

        let media = load_media(&conn).unwrap();
        let older_row = media
            .iter()
            .find(|item| item.filename == "older.png")
            .unwrap();
        let newer_row = media
            .iter()
            .find(|item| item.filename == "newer.png")
            .unwrap();
        assert_eq!(
            older_row.file_modified_at.as_deref(),
            Some("2023-11-14 22:13:20")
        );
        assert_eq!(
            newer_row.file_modified_at.as_deref(),
            Some(format_unix_utc(1_800_000_000).as_str())
        );
        assert!(older_row.file_modified_at < newer_row.file_modified_at);
        assert!(!older_row.file_missing);
        let created_at = older_row.created_at.clone();

        conn.execute(
            "UPDATE Media SET description = 'keep me' WHERE filename = 'older.png'",
            [],
        )
        .unwrap();
        conn.execute("INSERT INTO Tag (name) VALUES ('rally')", [])
            .unwrap();
        conn.execute(
            "INSERT INTO MediaTag (mediaId, tagId)
             SELECT id, 1 FROM Media WHERE filename = 'older.png'",
            [],
        )
        .unwrap();
        fs::File::open(&older)
            .unwrap()
            .set_modified(std::time::UNIX_EPOCH + std::time::Duration::from_secs(1_800_000_000))
            .unwrap();
        let rescanned = rescan_root(&conn, first.root_id, |_| {}).unwrap();
        assert_eq!(rescanned.imported, 0);
        assert_eq!(rescanned.already_present, 2);
        assert_eq!(rescanned.missing, 0);
        let kept = load_media(&conn)
            .unwrap()
            .into_iter()
            .find(|item| item.filename == "older.png")
            .unwrap();
        assert_eq!(kept.description.as_deref(), Some("keep me"));
        assert_eq!(
            kept.tags
                .iter()
                .map(|tag| tag.name.as_str())
                .collect::<Vec<_>>(),
            ["rally"]
        );
        assert_eq!(kept.created_at, created_at);
        assert_eq!(
            kept.file_modified_at.as_deref(),
            Some(format_unix_utc(1_800_000_000).as_str())
        );

        fs::write(root.join("added.png"), b"png").unwrap();
        fs::remove_file(&newer).unwrap();
        let gained = rescan_root(&conn, first.root_id, |_| {}).unwrap();
        assert_eq!(gained.imported, 1);
        assert_eq!(gained.missing, 1);
        let after = load_media(&conn).unwrap();
        assert_eq!(after.len(), 3);
        let missing = after
            .iter()
            .find(|item| item.filename == "newer.png")
            .unwrap();
        assert!(missing.file_missing);
        assert!(after.iter().any(|item| item.filename == "added.png"));

        ingest_directory(&conn, &other, "pickleball", |_| {}).unwrap();
        let removed = remove_root(&conn, first.root_id).unwrap();
        assert!(removed.tags.iter().all(|tag| tag.name != "rally"));
        assert!(
            removed
                .media
                .iter()
                .all(|item| item.filename != "older.png")
        );
        assert!(removed.media.iter().any(|item| item.filename == "keep.png"));
        assert_eq!(removed.roots.len(), 1);
        assert!(older.exists());
        assert!(root.join("added.png").exists());
    }

    #[test]
    fn heic_imports_even_when_preview_conversion_fails() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        ensure_schema(&conn).unwrap();

        let root = std::env::temp_dir().join(format!("pickleball-heic-{}", Uuid::new_v4()));
        let _guard = scopeguard(&root);
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("shot.heic"), b"not-a-real-heic").unwrap();
        fs::write(root.join("notes.txt"), b"skip").unwrap();
        fs::write(root.join("plain.png"), b"png").unwrap();

        let outcome = ingest_directory(&conn, &root, "pickleball", |_| {}).unwrap();
        assert_eq!(outcome.imported, 2);
        assert_eq!(outcome.skipped, 1);
        let media = load_media(&conn).unwrap();
        let heic = media
            .iter()
            .find(|item| item.filename == "shot.heic")
            .unwrap();
        assert_eq!(heic.mediatype, "PHOTO");
        assert!(!heic.file_missing);
        if heic.preview_path.is_some() {
            assert!(!heic.preview_unavailable);
        } else {
            assert!(heic.preview_unavailable);
        }
        assert!(media.iter().any(|item| item.filename == "plain.png"));
    }

    #[cfg(unix)]
    #[test]
    fn converter_writes_a_jpeg_when_the_program_succeeds() {
        use std::os::unix::fs::PermissionsExt;

        let dir = std::env::temp_dir().join(format!("pickleball-convert-{}", Uuid::new_v4()));
        let _guard = scopeguard(&dir);
        fs::create_dir_all(&dir).unwrap();
        let program = dir.join("heif-convert");
        fs::write(&program, "#!/bin/sh\nprintf '\\xff\\xd8' > \"$2\"\n").unwrap();
        let mut permissions = fs::metadata(&program).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&program, permissions).unwrap();
        let source = dir.join("shot.heic");
        fs::write(&source, b"heic").unwrap();
        let dest = dir.join("out.jpg");
        assert!(run_converter(&program.to_string_lossy(), &source, &dest));
        assert!(dest.is_file());
    }

    fn scopeguard(path: &Path) -> impl Drop {
        struct Guard(PathBuf);
        impl Drop for Guard {
            fn drop(&mut self) {
                let _ = fs::remove_dir_all(&self.0);
            }
        }
        Guard(path.to_path_buf())
    }
}
