use std::path::Path;
use std::sync::Mutex;

use rusqlite::Connection;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::db::{self, IngestPayload, LibraryPayload, MediaRecord, RootRecord, TagRecord};
use crate::media_server::MediaServer;
use crate::watcher::RootWatcher;

use tauri_plugin_opener::OpenerExt;

pub struct Db(pub Mutex<Connection>);

fn allow_directory(app: &AppHandle, media: &MediaServer, directory: &Path) -> Result<(), String> {
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
    allow_preview_directory(app, media)
}

pub fn allow_preview_directory(app: &AppHandle, media: &MediaServer) -> Result<(), String> {
    allow_directory(app, media, &db::preview_directory())
}

fn sync_watches(db: &State<Db>, watcher: &State<RootWatcher>) {
    let Ok(conn) = db.0.lock() else {
        return;
    };
    if let Err(err) = watcher.sync(&conn) {
        log::warn!("failed to update folder watches: {err}");
    }
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
pub fn list_roots(db: State<'_, Db>) -> Result<Vec<RootRecord>, String> {
    with_db(&db, db::list_roots)
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
    watcher: State<'_, RootWatcher>,
    directory: String,
    category: String,
) -> Result<IngestPayload, String> {
    let path = Path::new(&directory);
    allow_directory(&app, &media, path)?;
    allow_preview_directory(&app, &media)?;
    let progress_app = app.clone();
    let payload = with_db(&db, |conn| {
        let outcome = db::ingest_directory(conn, path, &category, |progress| {
            let _ = progress_app.emit("ingest-progress", progress);
        })?;
        let library = db::list_library(conn)?;
        Ok(IngestPayload {
            imported: outcome.imported,
            already_present: outcome.already_present,
            skipped: outcome.skipped,
            media: library.media,
            tags: library.tags,
            roots: library.roots,
        })
    })?;
    sync_watches(&db, &watcher);
    Ok(payload)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RescanPayload {
    pub imported: i64,
    pub already_present: i64,
    pub skipped: i64,
    pub missing: i64,
    pub media: Vec<MediaRecord>,
    pub tags: Vec<TagRecord>,
    pub roots: Vec<RootRecord>,
}

#[tauri::command]
pub fn rescan_root(
    app: AppHandle,
    db: State<'_, Db>,
    watcher: State<'_, RootWatcher>,
    root_id: i64,
) -> Result<RescanPayload, String> {
    let progress_app = app.clone();
    let payload = with_db(&db, |conn| {
        let outcome = db::rescan_root(conn, root_id, |progress| {
            let _ = progress_app.emit("ingest-progress", progress);
        })?;
        let library = db::list_library(conn)?;
        Ok(RescanPayload {
            imported: outcome.imported,
            already_present: outcome.already_present,
            skipped: outcome.skipped,
            missing: outcome.missing,
            media: library.media,
            tags: library.tags,
            roots: library.roots,
        })
    })?;
    sync_watches(&db, &watcher);
    Ok(payload)
}

#[tauri::command]
pub fn remove_root(
    db: State<'_, Db>,
    watcher: State<'_, RootWatcher>,
    root_id: i64,
) -> Result<LibraryPayload, String> {
    let library = with_db(&db, |conn| db::remove_root(conn, root_id))?;
    sync_watches(&db, &watcher);
    Ok(library)
}

#[tauri::command]
pub fn reveal_media(app: AppHandle, db: State<'_, Db>, media_id: i64) -> Result<(), String> {
    let path = with_db(&db, |conn| db::media_filepath(conn, media_id))?
        .ok_or_else(|| format!("Media {media_id} was not found"))?;
    if !Path::new(&path).exists() {
        return Err(format!("File not found: {path}"));
    }
    app.opener()
        .reveal_item_in_dir(path)
        .map_err(|err| err.to_string())
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

#[tauri::command]
pub fn delete_all_media(
    db: State<'_, Db>,
    watcher: State<'_, RootWatcher>,
) -> Result<LibraryPayload, String> {
    let library = with_db(&db, db::delete_all_media)?;
    sync_watches(&db, &watcher);
    Ok(library)
}
