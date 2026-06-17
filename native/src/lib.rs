//! # SmartCursorX Native Modules
//!
//! Performance-critical components written in Rust for the SmartCursorX IDE.
//!
//! ## Modules
//! - `search`: Fast regex file search (ripgrep-style)
//! - `indexer`: File system indexing and watching

#![deny(clippy::all)]

use napi_derive::napi;

mod search;
// mod indexer;  // TODO: Implement later

// Re-export public functions
pub use search::*;

/// Health check function to verify native module is loaded
#[napi]
pub fn native_health_check() -> String {
    "Rust native module loaded successfully!".to_string()
}

/// Get version of the native module
#[napi]
pub fn native_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
