use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::sync::mpsc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub struct WatcherState {
    watchers: HashMap<String, RecommendedWatcher>,
}

impl WatcherState {
    pub fn new() -> Self {
        WatcherState {
            watchers: HashMap::new(),
        }
    }

    pub fn watch(&mut self, path: String, app: AppHandle) -> Result<(), String> {
        if self.watchers.contains_key(&path) {
            return Ok(());
        }

        let path_clone = path.clone();
        let (tx, rx) = mpsc::channel::<notify::Result<Event>>();

        let mut watcher = notify::recommended_watcher(move |res| {
            let _ = tx.send(res);
        }).map_err(|e| e.to_string())?;

        watcher.watch(std::path::Path::new(&path), RecursiveMode::NonRecursive)
            .map_err(|e| e.to_string())?;

        self.watchers.insert(path.clone(), watcher);

        std::thread::spawn(move || {
            loop {
                match rx.recv_timeout(Duration::from_millis(200)) {
                    Ok(Ok(event)) => {
                        let _ = app.emit("fs-change", serde_json::json!({
                            "path": path_clone,
                            "kind": format!("{:?}", event.kind),
                        }));
                    }
                    Ok(Err(_)) => break,
                    Err(mpsc::RecvTimeoutError::Disconnected) => break,
                    Err(mpsc::RecvTimeoutError::Timeout) => {}
                }
            }
        });

        Ok(())
    }

    pub fn unwatch(&mut self, path: &str) {
        self.watchers.remove(path);
    }
}
