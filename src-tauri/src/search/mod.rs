use fuzzy_matcher::FuzzyMatcher;
use fuzzy_matcher::skim::SkimMatcherV2;
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub score: i64,
    pub size: u64,
    pub modified: Option<String>,
}

pub fn search_in_directory(
    root: &str,
    query: &str,
    include_hidden: bool,
    max_results: usize,
    case_sensitive: bool,
) -> Vec<SearchResult> {
    let matcher = SkimMatcherV2::default();
    let q = if case_sensitive { query.to_string() } else { query.to_lowercase() };

    let mut results: Vec<SearchResult> = WalkDir::new(root)
        .follow_links(false)
        .max_depth(20)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.depth() > 0)
        .filter_map(|entry| {
            let path = entry.path();
            let name = path.file_name()?.to_string_lossy().into_owned();

            if !include_hidden && crate::fs::is_hidden(path) {
                return None;
            }

            let haystack = if case_sensitive { name.clone() } else { name.to_lowercase() };
            let score = matcher.fuzzy_match(&haystack, &q)?;

            let meta = entry.metadata().ok()?;
            Some(SearchResult {
                path: path.to_string_lossy().into_owned(),
                name,
                is_dir: meta.is_dir(),
                score,
                size: if meta.is_file() { meta.len() } else { 0 },
                modified: meta.modified().ok()
                    .and_then(|t| crate::fs::system_time_to_string(t)),
            })
        })
        .collect();

    results.sort_by(|a, b| b.score.cmp(&a.score));
    results.truncate(max_results);
    results
}
