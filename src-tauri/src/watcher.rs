use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use rusqlite::Connection;
use serde::Serialize;

use crate::db;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RootChanged {
    pub root_id: i64,
    pub path: String,
}

#[derive(Clone)]
struct WatchedRoot {
    id: i64,
    path: PathBuf,
}

pub struct RootWatcher {
    watcher: Mutex<RecommendedWatcher>,
    watched: Mutex<Vec<PathBuf>>,
    roots: Arc<Mutex<Vec<WatchedRoot>>>,
}

impl RootWatcher {
    pub fn start(on_change: impl Fn(i64, String) + Send + Sync + 'static) -> Result<Self, String> {
        let (tx, rx) = mpsc::channel();
        let watcher =
            RecommendedWatcher::new(tx, Config::default()).map_err(|err| err.to_string())?;
        let roots = Arc::new(Mutex::new(Vec::new()));
        let roots_for_thread = roots.clone();
        thread::spawn(move || debounce_loop(rx, roots_for_thread, on_change));
        Ok(Self {
            watcher: Mutex::new(watcher),
            watched: Mutex::new(Vec::new()),
            roots,
        })
    }

    pub fn sync(&self, conn: &Connection) -> Result<(), String> {
        let records = db::list_roots(conn).map_err(|err| err.to_string())?;
        let desired: Vec<WatchedRoot> = records
            .into_iter()
            .map(|root| WatchedRoot {
                id: root.id,
                path: PathBuf::from(root.path),
            })
            .filter(|root| root.path.is_dir())
            .collect();

        let mut watcher = self.watcher.lock().map_err(|err| err.to_string())?;
        let mut watched = self.watched.lock().map_err(|err| err.to_string())?;
        for path in watched.iter() {
            if !desired.iter().any(|root| root.path == *path) {
                let _ = watcher.unwatch(path);
            }
        }
        let mut next = Vec::new();
        for root in &desired {
            if watched.iter().any(|path| path == &root.path) {
                next.push(root.path.clone());
                continue;
            }
            if watcher.watch(&root.path, RecursiveMode::Recursive).is_ok() {
                next.push(root.path.clone());
            }
        }
        *watched = next;
        let mut roots = self.roots.lock().map_err(|err| err.to_string())?;
        *roots = desired;
        Ok(())
    }
}

fn debounce_loop(
    rx: Receiver<Result<Event, notify::Error>>,
    roots: Arc<Mutex<Vec<WatchedRoot>>>,
    on_change: impl Fn(i64, String),
) {
    while let Ok(first) = rx.recv() {
        let mut paths = event_paths(first);
        loop {
            match rx.recv_timeout(Duration::from_millis(500)) {
                Ok(event) => paths.extend(event_paths(event)),
                Err(mpsc::RecvTimeoutError::Timeout) => break,
                Err(mpsc::RecvTimeoutError::Disconnected) => return,
            }
        }
        let Ok(roots) = roots.lock() else {
            continue;
        };
        let mut emitted = Vec::new();
        for path in &paths {
            for root in roots.iter() {
                if emitted.contains(&root.id) || !path_in_root(path, &root.path) {
                    continue;
                }
                emitted.push(root.id);
                on_change(root.id, root.path.to_string_lossy().into_owned());
            }
        }
    }
}

fn event_paths(message: Result<Event, notify::Error>) -> Vec<PathBuf> {
    let Ok(event) = message else {
        return Vec::new();
    };
    if matches!(event.kind, EventKind::Access(_)) {
        return Vec::new();
    }
    event.paths
}

fn path_in_root(path: &Path, root: &Path) -> bool {
    path == root || path.starts_with(root)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn path_in_root_matches_children_only() {
        let root = Path::new("/library/match");
        assert!(path_in_root(Path::new("/library/match"), root));
        assert!(path_in_root(Path::new("/library/match/rally.mp4"), root));
        assert!(!path_in_root(Path::new("/library/match-2/rally.mp4"), root));
        assert!(!path_in_root(Path::new("/library/other"), root));
    }

    #[test]
    fn watcher_reports_a_change_and_stops_after_the_root_is_gone() {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("pickleball-watch-{stamp}"));
        fs::create_dir_all(&dir).unwrap();
        let canonical = fs::canonicalize(&dir).unwrap();

        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        db::ensure_schema(&conn).unwrap();
        conn.execute(
            "INSERT INTO LibraryRoot (path) VALUES (?1)",
            [canonical.to_string_lossy().to_string()],
        )
        .unwrap();

        let (tx, rx) = mpsc::channel();
        let watcher = RootWatcher::start(move |id, path| {
            let _ = tx.send((id, path));
        })
        .unwrap();
        watcher.sync(&conn).unwrap();
        thread::sleep(Duration::from_millis(700));
        while rx.try_recv().is_ok() {}

        fs::write(canonical.join("new.png"), b"png").unwrap();
        let (id, path) = rx
            .recv_timeout(Duration::from_secs(3))
            .expect("watched folder should report a change");
        assert_eq!(id, 1);
        assert_eq!(path, canonical.to_string_lossy());

        conn.execute("DELETE FROM LibraryRoot", []).unwrap();
        watcher.sync(&conn).unwrap();
        thread::sleep(Duration::from_millis(700));
        while rx.try_recv().is_ok() {}
        fs::write(canonical.join("later.png"), b"png").unwrap();
        assert!(
            rx.recv_timeout(Duration::from_millis(800)).is_err(),
            "removed root should not keep emitting"
        );
        let _ = fs::remove_dir_all(&dir);
    }
}
