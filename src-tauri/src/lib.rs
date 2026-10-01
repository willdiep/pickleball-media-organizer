mod commands;
mod db;
mod media_server;

use std::sync::Mutex;

use tauri::Manager;

use commands::Db;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let media = media_server::start().map_err(setup_error)?;
            let conn = db::open_database().map_err(setup_error)?;
            commands::allow_stored_directories(app.handle(), &media, &conn)
                .map_err(setup_error)?;
            app.manage(media);
            app.manage(Db(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_media,
            commands::list_tags,
            commands::get_media,
            commands::ingest_folder,
            commands::update_tags,
            commands::update_description,
            commands::delete_media,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}

fn setup_error(err: impl ToString) -> Box<dyn std::error::Error> {
    Box::new(std::io::Error::other(err.to_string()))
}
