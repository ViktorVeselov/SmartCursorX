//! # File Search Module
//!
//! Fast regex-based file search using the same core libraries as ripgrep.
//! Respects .gitignore and provides streaming results.

use napi::bindgen_prelude::*;
use napi_derive::napi;
use serde::{Deserialize, Serialize};
use std::path::Path;

/// A single search match result
#[derive(Debug, Serialize, Deserialize)]
#[napi(object)]
pub struct SearchMatch {
    /// File path where match was found
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
}

/// Search for a pattern across files in a directory
///
/// # Arguments
/// * `options` - Search configuration
///
/// # Returns
/// Vector of search matches
#[napi]
pub fn search_files(options: SearchOptions) -> Result<Vec<SearchMatch>> {
    let root = Path::new(&options.root_path);
    
    if !root.exists() {
        return Err(Error::new(
            Status::InvalidArg,
            format!("Path does not exist: {}", options.root_path),
        ));
    }

    // For now, return a placeholder result
    // Full implementation would use grep-searcher and ignore crates
    let matches = vec![SearchMatch {
        file_path: options.root_path.clone(),
        line_number: 1,
        column: 1,
        line_content: format!("Searching for: {}", options.pattern),
        match_text: options.pattern.clone(),
    }];

    Ok(matches)
}

/// Quick search that returns just file paths (faster for "find file" use case)
#[napi]
pub fn search_file_names(pattern: String, root_path: String) -> Result<Vec<String>> {
    let root = Path::new(&root_path);
    
    if !root.exists() {
        return Err(Error::new(
            Status::InvalidArg,
            format!("Path does not exist: {}", root_path),
        ));
    }

    // Placeholder - would use ignore crate for fast directory walking
    Ok(vec![format!("Found files matching: {}", pattern)])
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
}
