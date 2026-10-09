mod commands;
mod db;
mod media_server;

use std::sync::Mutex;

use tauri::menu::{Menu, MenuItem};
use tauri::{Emitter, Manager};

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

            let app_menu = MenuItem::with_id(
                app,
                "app-menu",
                "pickleball-media-organizer",
                true,
                Some("CmdOrCtrl+,"),
            )?;
            app.set_menu(Menu::with_items(app, &[&app_menu])?)?;
            if let Some(window) = app.get_webview_window("main") {
                open_menu_on_bar_click(&window);
            }
            app.on_menu_event(|app_handle, event| {
                if event.id() == "app-menu" {
                    let _ = app_handle.emit("app-menu", ());
                }
            });

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

fn open_menu_on_bar_click(_window: &tauri::WebviewWindow) {
    #[cfg(any(
        target_os = "linux",
        target_os = "dragonfly",
        target_os = "freebsd",
        target_os = "netbsd",
        target_os = "openbsd"
    ))]
    {
        use gtk::prelude::*;

        let Ok(vbox) = _window.default_vbox() else {
            return;
        };
        let Some(bar) = find_menubar(vbox.upcast_ref()) else {
            return;
        };
        bar.foreach(|child| {
            let Some(item) = child.downcast_ref::<gtk::MenuItem>() else {
                return;
            };
            // A leaf item in a GTK menu bar highlights on click but does not
            // emit activate, so the app menu would never open.
            item.connect_button_press_event(|item, event| {
                if event.button() == 1 {
                    item.activate();
                    gtk::glib::Propagation::Stop
                } else {
                    gtk::glib::Propagation::Proceed
                }
            });
        });
    }
}

#[cfg(any(
    target_os = "linux",
    target_os = "dragonfly",
    target_os = "freebsd",
    target_os = "netbsd",
    target_os = "openbsd"
))]
fn find_menubar(widget: &gtk::Widget) -> Option<gtk::MenuBar> {
    use gtk::prelude::*;

    if let Some(bar) = widget.downcast_ref::<gtk::MenuBar>() {
        return Some(bar.clone());
    }
    let container = widget.downcast_ref::<gtk::Container>()?;
    let mut found = None;
    container.foreach(|child| {
        if found.is_none() {
            found = find_menubar(child);
        }
    });
    found
}

fn setup_error(err: impl ToString) -> Box<dyn std::error::Error> {
    Box::new(std::io::Error::other(err.to_string()))
}
