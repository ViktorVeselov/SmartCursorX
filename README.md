# Cursor Replacer

An AI-first IDE with Vim mode, built with Electron + React + Rust.

## Architecture

```
cursor-replacer/
├── electron/           # Electron main process (TypeScript)
│   ├── main.ts        # Window, IPC router
│   ├── preload.ts     # Secure bridge to renderer
│   └── ipc/           # IPC handlers by domain
├── src/               # Renderer process (React + TypeScript)
│   ├── components/    # UI components
│   ├── hooks/         # Custom React hooks
│   ├── stores/        # State management
│   └── utils/         # Shared utilities
├── native/            # Rust native modules (napi-rs)
│   ├── src/
│   │   ├── lib.rs     # Module exports
│   │   ├── search.rs  # File search (ripgrep-style)
│   │   └── indexer.rs # File indexing
│   └── Cargo.toml
└── docs/              # Project documentation
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React + TypeScript | UI/UX |
| Editor | Monaco + monaco-vim | Code editing |
| Desktop | Electron | Cross-platform |
| Performance | Rust (napi-rs) | Search, indexing |
| Database | sql.js | Local persistence |

## Development

```bash
# Install dependencies
npm install

# Build native modules
npm run build:native

# Start dev server
npm run dev

# Build for production
npm run build
```

## Code Standards

- **TypeScript**: Strict mode, no `any`
- **Rust**: `clippy` lints, `rustfmt`
- **Components**: One component per file
- **Naming**: PascalCase (components), camelCase (functions), SCREAMING_SNAKE (constants)

## License

MIT
