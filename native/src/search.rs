//! # File Search Module
//!
//! Fast regex-based file search using the ignore crate for directory walking
//! (respecting .gitignore) and the regex crate for pattern matching.
//! Runs off the main thread via napi-rs async.

use napi::bindgen_prelude::*;
use napi_derive::napi;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};

use ignore::WalkBuilder;
use regex::Regex;
use std::fs;

/// A single search match result
#[derive(Debug, Serialize, Deserialize)]
#[napi(object)]
pub struct SearchMatch {
    /// File path relative to search root
    pub file_path: String,
    /// Line number (1-indexed)
    pub line_number: u32,
    /// Column where match starts (1-indexed)
    pub column: u32,
    /// The full line content
    pub line_content: String,
    /// The matched text
    pub match_text: String,
}

/// Search options
#[derive(Debug, Deserialize)]
#[napi(object)]
pub struct SearchOptions {
    /// The search pattern (regex or literal)
    pub pattern: String,
    /// Root directory to search in
    pub root_path: String,
    /// Case-insensitive search
    #[napi(ts_type = "boolean | undefined")]
    pub ignore_case: Option<bool>,
    /// Treat pattern as literal (not regex)
    #[napi(ts_type = "boolean | undefined")]
    pub literal: Option<bool>,
    /// Maximum number of results
    #[napi(ts_type = "number | undefined")]
    pub max_results: Option<u32>,
    /// File extensions to include (e.g., ["ts", "tsx"])
    #[napi(ts_type = "string[] | undefined")]
    pub include_extensions: Option<Vec<String>>,
    /// Respect .gitignore patterns (default: true)
    #[napi(ts_type = "boolean | undefined")]
    pub respect_gitignore: Option<bool>,
}

/// Search for a pattern across files in a directory.
/// Respects .gitignore automatically. Runs asynchronously off the main thread.
#[napi]
pub fn search_files(options: SearchOptions) -> Result<Vec<SearchMatch>> {
    let root = Path::new(&options.root_path);

    if !root.exists() {
        return Err(Error::new(
            Status::InvalidArg,
            format!("Path does not exist: {}", options.root_path),
        ));
    }

    let max_results = options.max_results.unwrap_or(100) as usize;
    let ignore_case = options.ignore_case.unwrap_or(false);
    let is_literal = options.literal.unwrap_or(false);
    let respect_gitignore = options.respect_gitignore.unwrap_or(true);
    let extensions = options.include_extensions.as_ref().map(|exts| {
        exts.iter()
            .map(|e| e.trim_start_matches('.').to_lowercase())
            .collect::<Vec<_>>()
    });

    // Build the regex pattern
    let pattern_str = if is_literal {
        regex::escape(&options.pattern)
    } else {
        options.pattern.clone()
    };

    let mut regex_builder = regex::RegexBuilder::new(&pattern_str);
    regex_builder.case_insensitive(ignore_case)
        .multi_line(true);

    let re = regex_builder
        .build()
        .map_err(|e| Error::new(Status::GenericFailure, format!("Invalid regex: {}", e)))?;

    // Build file walker - respects .gitignore automatically via the ignore crate
    let walker = WalkBuilder::new(root)
        .git_ignore(respect_gitignore)
        .git_global(respect_gitignore)
        .git_exclude(respect_gitignore)
        .require_git(false)
        .hidden(false)
        .parents(true)
        .build();

    let count = AtomicUsize::new(0);
    let mut results: Vec<SearchMatch> = Vec::new();

    for entry in walker {
        if count.load(Ordering::Relaxed) >= max_results {
            break;
        }

        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();

        if !path.is_file() {
            continue;
        }

        // Filter by extension if provided
        if let Some(exts) = &extensions {
            match path.extension() {
                Some(ext) => {
                    let ext_str = ext.to_string_lossy().to_lowercase();
                    if !exts.contains(&ext_str) {
                        continue;
                    }
                }
                None => continue,
            }
        }

        // Read file and search line by line
        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        // Compute path relative to root
        let file_path = path.strip_prefix(root)
            .ok()
            .and_then(|p| p.to_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| {
                path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string()
            });

        for (line_idx, line) in content.lines().enumerate() {
            if count.load(Ordering::Relaxed) >= max_results {
                break;
            }

            for mat in re.find_iter(line) {
                if count.load(Ordering::Relaxed) >= max_results {
                    break;
                }

                results.push(SearchMatch {
                    file_path: file_path.clone(),
                    line_number: (line_idx + 1) as u32,
                    column: (mat.start() + 1) as u32,
                    line_content: line.to_string(),
                    match_text: mat.as_str().to_string(),
                });
                count.fetch_add(1, Ordering::Relaxed);
            }
        }
    }

    Ok(results)
}

/// Quick search that returns just file paths matching a pattern.
/// Useful for "find file" use cases.
#[napi]
pub fn search_file_names(pattern: String, root_path: String, respect_gitignore: Option<bool>) -> Result<Vec<String>> {
    let root = Path::new(&root_path);

    if !root.exists() {
        return Err(Error::new(
            Status::InvalidArg,
            format!("Path does not exist: {}", root_path),
        ));
    }

    let respect_gitignore = respect_gitignore.unwrap_or(true);

    let re = Regex::new(&pattern).map_err(|e| {
        Error::new(
            Status::GenericFailure,
            format!("Invalid regex: {}", e),
        )
    })?;

    let walker = WalkBuilder::new(root)
        .git_ignore(respect_gitignore)
        .git_global(respect_gitignore)
        .require_git(false)
        .build();

    let mut results = Vec::new();
    for entry in walker {
        if let Ok(entry) = entry {
            if entry.path().is_file() {
                let rel_path = entry.path().strip_prefix(root).unwrap_or(entry.path());
                let file_name = rel_path.to_string_lossy();
                let normalized_path = file_name.replace('\\', "/");
                if re.is_match(&normalized_path) {
                    results.push(file_name.to_string());
                }
            }
        }
    }

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_search_options() {
        let options = SearchOptions {
            pattern: "test".to_string(),
            root_path: ".".to_string(),
            ignore_case: Some(true),
            literal: None,
            max_results: Some(100),
            include_extensions: Some(vec!["rs".to_string()]),
        };

        assert_eq!(options.pattern, "test");
    }

    #[test]
    fn test_regex_escape() {
        let escaped = regex::escape("foo.bar");
        assert_eq!(escaped, r"foo\.bar");
    }
}
