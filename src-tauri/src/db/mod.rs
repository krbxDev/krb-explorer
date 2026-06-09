use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Favorite {
    pub id: i64,
    pub path: String,
    pub name: String,
    pub order_index: i64,
    pub is_search: bool,
    pub search_query: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: i64,
    pub path: String,
    pub visited_at: String,
    pub is_file: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ColumnWidth {
    pub col: String,
    pub width: i64,
}

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new(db_path: &Path) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        let db = Database { conn };
        db.init_schema()?;
        Ok(db)
    }

    /// Provide raw access to the underlying connection for ad-hoc queries.
    pub fn conn(&self) -> &Connection {
        &self.conn
    }

    fn init_schema(&self) -> Result<()> {
        self.conn.execute_batch("
            PRAGMA journal_mode=WAL;
            PRAGMA synchronous=NORMAL;

            CREATE TABLE IF NOT EXISTS favorites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                order_index INTEGER NOT NULL DEFAULT 0,
                is_search INTEGER NOT NULL DEFAULT 0,
                search_query TEXT
            );

            CREATE TABLE IF NOT EXISTS tags (
                path TEXT NOT NULL,
                tag TEXT NOT NULL,
                color TEXT,
                PRIMARY KEY (path, tag)
            );

            CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT NOT NULL,
                visited_at TEXT NOT NULL DEFAULT (datetime('now')),
                is_file INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS thumbnails (
                path TEXT NOT NULL PRIMARY KEY,
                data TEXT NOT NULL,
                mtime INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS column_widths (
                col TEXT NOT NULL PRIMARY KEY,
                width INTEGER NOT NULL DEFAULT 200
            );

            CREATE INDEX IF NOT EXISTS idx_history_path ON history(path);
            CREATE INDEX IF NOT EXISTS idx_history_time ON history(visited_at DESC);
            CREATE INDEX IF NOT EXISTS idx_tags_path ON tags(path);
        ")?;
        Ok(())
    }

    pub fn get_favorites(&self) -> Result<Vec<Favorite>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, path, name, order_index, is_search, search_query FROM favorites ORDER BY order_index"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Favorite {
                id: row.get(0)?,
                path: row.get(1)?,
                name: row.get(2)?,
                order_index: row.get(3)?,
                is_search: row.get::<_, i64>(4)? != 0,
                search_query: row.get(5)?,
            })
        })?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn add_favorite(&self, path: &str, name: &str, is_search: bool, search_query: Option<&str>) -> Result<i64> {
        let max_order: i64 = self.conn.query_row(
            "SELECT COALESCE(MAX(order_index), -1) FROM favorites", [], |r| r.get(0)
        ).unwrap_or(-1);
        self.conn.execute(
            "INSERT OR REPLACE INTO favorites (path, name, order_index, is_search, search_query) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![path, name, max_order + 1, is_search as i64, search_query],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn remove_favorite(&self, path: &str) -> Result<()> {
        self.conn.execute("DELETE FROM favorites WHERE path = ?1", params![path])?;
        Ok(())
    }

    pub fn get_tags(&self, path: &str) -> Result<Vec<String>> {
        let mut stmt = self.conn.prepare("SELECT tag FROM tags WHERE path = ?1")?;
        let rows = stmt.query_map(params![path], |r| r.get(0))?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn set_tag(&self, path: &str, tag: &str, color: Option<&str>, remove: bool) -> Result<()> {
        if remove {
            self.conn.execute("DELETE FROM tags WHERE path = ?1 AND tag = ?2", params![path, tag])?;
        } else {
            self.conn.execute(
                "INSERT OR REPLACE INTO tags (path, tag, color) VALUES (?1, ?2, ?3)",
                params![path, tag, color],
            )?;
        }
        Ok(())
    }

    pub fn add_history(&self, path: &str, is_file: bool) -> Result<()> {
        self.conn.execute(
            "INSERT INTO history (path, is_file) VALUES (?1, ?2)",
            params![path, is_file as i64],
        )?;
        self.conn.execute(
            "DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY visited_at DESC LIMIT 500)",
            [],
        )?;
        Ok(())
    }

    pub fn get_history(&self, limit: usize, files_only: bool) -> Result<Vec<HistoryEntry>> {
        let sql = if files_only {
            "SELECT id, path, visited_at, is_file FROM history WHERE is_file=1 ORDER BY visited_at DESC LIMIT ?1"
        } else {
            "SELECT id, path, visited_at, is_file FROM history ORDER BY visited_at DESC LIMIT ?1"
        };
        let mut stmt = self.conn.prepare(sql)?;
        let rows = stmt.query_map(params![limit as i64], |row| {
            Ok(HistoryEntry {
                id: row.get(0)?,
                path: row.get(1)?,
                visited_at: row.get(2)?,
                is_file: row.get::<_, i64>(3)? != 0,
            })
        })?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn get_thumbnail(&self, path: &str, mtime: i64) -> Result<Option<String>> {
        let result: rusqlite::Result<(String, i64)> = self.conn.query_row(
            "SELECT data, mtime FROM thumbnails WHERE path = ?1",
            params![path],
            |r| Ok((r.get(0)?, r.get(1)?)),
        );
        match result {
            Ok((data, cached_mtime)) if cached_mtime == mtime => Ok(Some(data)),
            _ => Ok(None),
        }
    }

    pub fn set_thumbnail(&self, path: &str, data: &str, mtime: i64) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO thumbnails (path, data, mtime) VALUES (?1, ?2, ?3)",
            params![path, data, mtime],
        )?;
        Ok(())
    }

    pub fn get_column_widths(&self) -> Result<Vec<ColumnWidth>> {
        let mut stmt = self.conn.prepare("SELECT col, width FROM column_widths")?;
        let rows = stmt.query_map([], |r| Ok(ColumnWidth { col: r.get(0)?, width: r.get(1)? }))?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn set_column_width(&self, col: &str, width: i64) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO column_widths (col, width) VALUES (?1, ?2)",
            params![col, width],
        )?;
        Ok(())
    }
}
