# SmartCursorX

An AI-first IDE with Vim mode, built with Electron + React + Rust. 

SmartCursorX has been meticulously scrutinized and hardened to deliver a highly secure local AI development environment, featuring zero plain-text API key leakage, loopback bound controller containment, and a pluggable cognitive steering taxonomy engine.

---

## 🚀 Live Portal & Downloads

Visit our live Documentation and Download Center to get the newest setup package:

### 🔗 **[Launch SmartCursorX Download Center](https://ViktorVeselov.github.io/SmartCursorX/)**

* **Windows Installer:** Standalone NSIS installer package (`SmartCursorX-Windows-0.0.3-alpha-Setup.exe`)

---

## Hardened Core Security

To guarantee absolute sandbox safety during autonomous loops and local execution, SmartCursorX implements the following security vectors:

* **Zero Plaintext API Keys:** Plaintext credentials are banned from databases. Keys are dynamically encrypted at the OS level using Windows DPAPI (via safeStorage) in our `secureStore` service.
* **Localhost Bound Admin REST API:** The controller REST endpoint strictly binds to the local loopback `127.0.0.1`. External connections are ignored and DNS-rebinding attempts are blocked.
* **Whitelisted IPC Preload Bridge:** Communication between the Monaco Editor renderer process and the main controller is fully locked down using a strict IPC event whitelist in `preload.ts`.
* **Path-Traversal Protections:** Execution loops check target paths against active workspace roots, aborting any operations attempting relative traversal (`../`).

---

## Pluggable Taxonomy Steering Engine

Leveraging standard Google Agent Development Kit (ADK) community protocols, SmartCursorX incorporates a pluggable steering engine to control agent behavior dynamically:
1. **Dynamic Prompt Shaping:** Tailors the global agent `system_instruction` at prompt boundaries to inject compliance directions on-the-fly.
2. **Dynamic Tool Description Tempering:** Modifies skill descriptions before rendering in prompt XML trees to steer LLM action selection.
3. **Skill Prioritization:** Reorders and bubble-sorts preferred or safety-critical skills to the top of the prompt list.

---

## Architecture

```
cursor-replacer/
├── electron/           # Electron main process (TypeScript)
│   ├── main.ts         # Window controller, global assertions
│   ├── preload.ts      # Whitelisted IPC bridge
│   ├── db.ts           # SQLite & sqlite-vec database service
│   ├── secureStore.ts  # OS-level safeStorage DPAPI enforcer
│   └── services/       # Containment and execution loops
├── src/                # Renderer process (React + TypeScript)
│   ├── components/     # UI, Terminal Panel, Monaco Editor wrapper
│   ├── hooks/          # Custom React hooks
│   └── App.tsx         # Main UI entry point
├── docs/               # GitHub Pages live portal
│   ├── index.html      # Structural semantic entry page
│   ├── styles.css      # Glassmorphic themes & tailormade colors
│   └── script.js       # Clipboard utility scripting
├── native/             # Rust native modules (napi-rs)
│   ├── src/            # High-performance search & vector index
│   └── Cargo.toml
└── package.json        # Dependencies & packaging triggers
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React + TypeScript | UI/UX |
| Editor | Monaco + monaco-vim | Code editing |
| Desktop | Electron | Cross-platform |
| Performance | Rust (napi-rs) | Search, indexing |
| Database | SQLite (`better-sqlite3` + `sqlite-vec`) | Local persistence & RAG indexes |

---

## Development & Packaging

```bash
# 1. Install dependencies
npm install

# 2. Start dev server
npm run dev

# 3. Compile React UI and package secure Windows installer
npm run build
```

*(Note: Production packages skip native rebuild blocks (`npmRebuild: false`) to bypass local MSBuild environment restrictions, compiling directly into standalone NSIS setups).*

---

## License

Apache-2.0 license
