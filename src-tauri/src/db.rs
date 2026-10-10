use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::types::ValueRef;
use rusqlite::{Connection, Row, params};
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
    pub created_at: String,
    pub updated_at: String,
    pub tags: Vec<TagRecord>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryPayload {
    pub media: Vec<MediaRecord>,
    pub tags: Vec<TagRecord>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestPayload {
    pub imported: i64,
    pub skipped: i64,
    pub media: Vec<MediaRecord>,
    pub tags: Vec<TagRecord>,
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

fn ensure_schema(conn: &Connection) -> rusqlite::Result<()> {
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
    Ok(())
}

pub fn list_library(conn: &Connection) -> rusqlite::Result<LibraryPayload> {
    Ok(LibraryPayload {
        media: load_media(conn)?,
        tags: load_tags(conn)?,
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
    tx.commit()?;
    list_library(conn)
}

pub fn ingest_directory(conn: &Connection, directory: &Path) -> rusqlite::Result<(i64, i64)> {
    if !directory.is_dir() {
        return Err(rusqlite::Error::InvalidParameterName(format!(
            "Not a directory: {}",
            directory.display()
        )));
    }

    let mut imported = 0_i64;
    let mut skipped = 0_i64;
    let tx = conn.unchecked_transaction()?;
    for entry in WalkDir::new(directory).into_iter().filter_map(Result::ok) {
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        let Some(mediatype) = infer_media_type(path) else {
            skipped += 1;
            continue;
        };
        let Some(filename) = path.file_name().and_then(|name| name.to_str()) else {
            skipped += 1;
            continue;
        };
        let filepath = path.to_string_lossy().to_string();
        let group_path =
            group_path_for(directory, path).map(|group| group.to_string_lossy().into_owned());
        tx.execute(
            "INSERT INTO Media (uuid, filename, filepath, mediatype, group_path, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'), datetime('now'))
             ON CONFLICT(filepath) DO UPDATE SET group_path = excluded.group_path",
            params![
                Uuid::new_v4().to_string(),
                filename,
                filepath,
                mediatype,
                group_path
            ],
        )?;
        // A conflicting filepath keeps its tags and description. Only group_path
        // is refreshed so importing the same folder again can attach grouping.
        imported += 1;
    }
    tx.commit()?;
    Ok((imported, skipped))
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
        "SELECT id, uuid, filename, filepath, mediatype, description, created_at, updated_at, group_path
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
        Ok(MediaRecord {
            id: row.get(0)?,
            uuid: row.get(1)?,
            filename: row.get(2)?,
            filepath: row.get(3)?,
            mediatype: row.get(4)?,
            description: row.get(5)?,
            group_path: row.get(8)?,
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

fn infer_media_type(path: &Path) -> Option<&'static str> {
    let ext = path.extension()?.to_str()?.to_ascii_lowercase();
    match ext.as_str() {
        "mp4" | "mov" | "m4v" | "webm" | "avi" => Some("VIDEO"),
        "jpg" | "jpeg" | "png" | "gif" | "webp" => Some("PHOTO"),
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

        conn.execute(
            "INSERT INTO Media (uuid, filename, filepath, mediatype, description, group_path, created_at, updated_at)
             VALUES ('keep-a1', 'a1.png', ?1, 'PHOTO', 'keep me', NULL, datetime('now'), datetime('now'))",
            [a1.to_string_lossy().to_string()],
        )
        .unwrap();

        let (imported, skipped) = ingest_directory(&conn, &root).unwrap();
        assert_eq!(imported, 4);
        assert_eq!(skipped, 1);

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

        let (imported_again, skipped_again) = ingest_directory(&conn, &root).unwrap();
        assert_eq!(imported_again, 4);
        assert_eq!(skipped_again, 1);
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
