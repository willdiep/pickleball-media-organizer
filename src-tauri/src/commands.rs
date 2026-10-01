use std::path::Path;
use std::sync::Mutex;

use rusqlite::Connection;
use tauri::{AppHandle, Manager, State};

use crate::db::{self, IngestPayload, LibraryPayload, MediaRecord, TagRecord};
use crate::media_server::MediaServer;

pub struct Db(pub Mutex<Connection>);

fn allow_directory(
    app: &AppHandle,
    media: &MediaServer,
    directory: &Path,
) -> Result<(), String> {
    media.allow_directory(directory);
    if !directory.exists() {
        return Ok(());
    }
    app.asset_protocol_scope()
        .allow_directory(directory, true)
        .map_err(|err| err.to_string())
}

pub fn allow_stored_directories(
    app: &AppHandle,
    media: &MediaServer,
    conn: &Connection,
) -> Result<(), String> {
    for directory in db::stored_directories(conn).map_err(|err| err.to_string())? {
        allow_directory(app, media, &directory)?;
    }
    Ok(())
}

fn with_db<T>(
    db: &State<Db>,
    action: impl FnOnce(&Connection) -> rusqlite::Result<T>,
) -> Result<T, String> {
    let conn = db.0.lock().map_err(|err| err.to_string())?;
    action(&conn).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn list_media(db: State<'_, Db>) -> Result<LibraryPayload, String> {
    with_db(&db, db::list_library)
}

#[tauri::command]
pub fn list_tags(db: State<'_, Db>) -> Result<Vec<TagRecord>, String> {
    with_db(&db, db::list_tags)
}

#[tauri::command]
pub fn get_media(db: State<'_, Db>, media_id: i64) -> Result<Option<MediaRecord>, String> {
    with_db(&db, |conn| db::get_media(conn, media_id))
}

#[tauri::command]
pub fn ingest_folder(
    app: AppHandle,
    media: State<'_, MediaServer>,
    db: State<'_, Db>,
    directory: String,
) -> Result<IngestPayload, String> {
    let path = Path::new(&directory);
    allow_directory(&app, &media, path)?;
    let (imported, skipped, library) = with_db(&db, |conn| {
        let (imported, skipped) = db::ingest_directory(conn, path)?;
        let library = db::list_library(conn)?;
        Ok((imported, skipped, library))
    })?;
    Ok(IngestPayload {
        imported,
        skipped,
        media: library.media,
        tags: library.tags,
    })
}

#[tauri::command]
pub fn update_tags(
    db: State<'_, Db>,
    media_id: i64,
    tags: Vec<String>,
) -> Result<UpdateResult, String> {
    let library = with_db(&db, |conn| db::update_tags(conn, media_id, tags))?;
    let media = library
        .media
        .into_iter()
        .find(|item| item.id == media_id)
        .ok_or_else(|| format!("Media {media_id} was not found"))?;
    Ok(UpdateResult {
        media,
        tags: library.tags,
    })
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateResult {
    pub media: MediaRecord,
    pub tags: Vec<TagRecord>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DescriptionResult {
    pub media: MediaRecord,
}

#[tauri::command]
pub fn update_description(
    db: State<'_, Db>,
    media_id: i64,
    description: String,
) -> Result<DescriptionResult, String> {
    let media = with_db(&db, |conn| {
        db::update_description(conn, media_id, description)
    })?
    .ok_or_else(|| format!("Media {media_id} was not found"))?;
    Ok(DescriptionResult { media })
}

#[tauri::command]
pub fn delete_media(db: State<'_, Db>, media_id: i64) -> Result<LibraryPayload, String> {
    with_db(&db, |conn| db::delete_media(conn, media_id))
}
