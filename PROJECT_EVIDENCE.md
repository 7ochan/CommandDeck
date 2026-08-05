# Project Evidence

## 1. Project Title

**CommandDeck** (Visual Terminal Workspace)

---

## 2. Project Overview

CommandDeck is a local-first desktop application designed to modernize and streamline developer terminal workflows. Traditional command-line interfaces often force developers to navigate fragmented terminal tabs, lose track of previously executed commands, and manually re-type repetitive command sequences across different project contexts. 

CommandDeck addresses these challenges by integrating a multi-session visual terminal workspace, persistent command history tracking, structured command execution, and AI-assisted workflow automation into a unified desktop software experience.

Built with an Electron desktop wrapper, Next.js web interface, and Node.js backend server, CommandDeck enables developers to organize terminal sessions by project workspaces, pin reusable command cards to a customizable visual deck, inspect historic session execution metrics, and generate AI-driven commit messages directly within their local development environment.

---

## 3. Project Objectives

- **Visual Session Management**: Provide a tabbed visual interface for running multiple terminal sessions concurrently with real-time output rendering.
- **Workspace Isolation**: Organize terminal working directories, command histories, and saved commands into distinct project workspaces.
- **Automatic Command Capture**: Persist executed shell commands, execution durations, exit codes, and timestamps into a local SQLite database.
- **Reusable Command Decks & Templates**: Allow developers to save, pin, parameterize, and re-execute frequent command snippets through a visual Command Deck and Command Palette.
- **AI Workflow Assistance**: Integrate with Google Gemini and OpenAI APIs to automate developer tasks such as drafting git commit messages from staged changes.
- **Native Desktop Integration**: Deliver a cross-platform desktop application (macOS, Windows, Linux) featuring window state persistence, keyboard shortcuts, splash loading screen, and background auto-updates.

---

## 4. Key Features

- **Multi-Tab Visual Terminals**: Real-time terminal emulation powered by `xterm.js` in the browser and native `node-pty` shell process manager on the server via WebSockets.
- **Workspace-Based Organization**: Isolated workspaces maintaining individual working directories, terminal states, and project-specific command collections.
- **Persistent Command History**: Automatic logging of executed shell commands into a local SQLite database using Drizzle ORM, with support for searching, filtering, and timestamp tracking.
- **Interactive Command Deck**: A visual card-based interface for pinning frequent commands, organizing them by position, and attaching custom display names and descriptions.
- **Parameterized Command Templates**: Support for template variables within saved commands (e.g., dynamic arguments), enabling quick variable substitution before execution.
- **Global Command Palette**: Accessible fuzzy-search launcher (`Cmd+K` / `Ctrl+K`) for executing commands, navigating workspaces, adjusting settings, and triggering quick actions.
- **Timeline View**: Visual chronological presentation (`/timeline`) grouping command history into activity sessions based on execution windows.
- **AI-Assisted Git Commit Generation**: Built-in integration with Google Gemini and OpenAI to inspect staged git diffs and automatically generate formatted commit messages.
- **Native Desktop Polish**: Electron desktop shell featuring window size and position persistence, platform-tailored application menus, and splash window loading handling.

---

## 5. Technology Stack

| Layer / Category | Technology / Library | Purpose in Project |
| :--- | :--- | :--- |
| **Desktop Shell** | Electron (v43.2.0) | Cross-platform desktop application container and native window management |
| **Frontend Framework** | Next.js (v16.2.11), React (v19.2.8) | App Router page rendering, component layout, and UI state management |
| **Terminal Rendering** | `@xterm/xterm` (v6.0.0), `@xterm/addon-fit` | High-performance canvas-based terminal emulation in the browser |
| **Backend / Runtime** | Node.js (v22+), Custom `server.ts` | Composition root, HTTP server, and process management engine |
| **Terminal Emulation** | `node-pty` (v1.2.0-beta.14) | Native pseudoterminal process spawner for system shells (`zsh`, `bash`, `cmd`) |
| **Real-time Transport** | `ws` (v8.21.1) | Low-latency bidirectional WebSocket connection streaming PTY data |
| **Database & ORM** | SQLite (`better-sqlite3` v13.0.1), Drizzle ORM (v0.45.2) | Local database engine and type-safe relational database schema management |
| **Styling & Icons** | Tailwind CSS (v4.3.3), PostCSS | Responsive dark-mode user interface styling and component layout |
| **Data Validation** | Zod (v4.4.3) | Runtime schema validation for WebSocket messages, API payloads, and settings |
| **AI Integration** | Google Gemini API, OpenAI API adapters | AI assistance services for generating git commit messages from code diffs |
| **Packaging & Build** | `electron-builder` (v26.15.3), TypeScript (v6.0.3) | Type-safe compilation, desktop bundler, and multi-platform distribution |
| **Testing Suite** | Vitest (v4.1.10) | Unit and integration test runner for client, server, DB, and shared modules |

---

## 6. Project Architecture

CommandDeck follows a local-first, layered architectural model designed to separate desktop windowing, web UI rendering, background server tasks, and data storage.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Electron Main Process                           │
│     (Native Window Management, App Menu, Updates, Window State)        │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Spawns & Navigates
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Next.js Web UI (Browser Renderer)                    │
│   (App Router, xterm.js, Command Deck, Command Palette, Timeline)      │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │ HTTP API Requests               │ WebSocket Stream
                   ▼                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 Node.js Server & Composition Root                      │
│                (server.ts / Next.js HTTP Server)                       │
├──────────────────────────────────┬─────────────────────────────────────┤
│  Terminal WebSocket Gateway      │  Application Services & AI Service  │
│  (node-pty Shell Subprocesses)   │  (Git, Settings, Workspace Manager) │
└──────────────────┬───────────────┴─────────────────┬───────────────────┘
                   │                                 │
                   ▼                                 ▼
┌──────────────────────────────────┐ ┌──────────────────────────────────┐
│      System Shell / OS PTY       │ │  SQLite Database & Drizzle ORM   │
│  (zsh / bash / powershell / cmd) │ │  (Workspaces, History, Settings) │
└──────────────────────────────────┘ └──────────────────────────────────┘
```

1. **Electron Main Process (`electron/main.ts`)**: Controls the application lifecycle, creates native windows, saves window bounds to `window-state.json`, builds application menus, and launches the Node server as a background utility process (`utilityProcess.fork`).
2. **Next.js UI (`src/app/`, `src/features/`)**: Renders the frontend interface using React components. High-frequency terminal rendering is handled directly by `xterm.js` instances.
3. **HTTP & WebSocket Server (`server.ts`, `src/server/`)**: Acts as the local backend. HTTP endpoints process structured CRUD requests, while a WebSocket server (`TerminalWebSocketServer`) handles bidirectional streaming between browser `xterm.js` terminals and backend `node-pty` processes.
4. **Data Persistence (`src/server/db/`)**: Stores all workspace metadata, terminal configurations, command histories, pinned deck items, and settings in a local SQLite file managed through Drizzle ORM.

---

## 7. Project Structure

Below is an overview of the key directories in the repository and their designated roles:

```text
command-deck/
├── docs/                             # Comprehensive architectural and technical documentation
├── electron/                         # Electron main process, preload scripts, icons, and updater
│   ├── assets/                       # Platform application icons (.icns, .ico, .png)
│   ├── main.ts                       # Native window lifecycle, IPC handlers, server launcher
│   ├── preload.ts                    # Context-isolated bridge between Electron and renderer
│   └── update-service.ts             # Application updater notification service
├── scripts/                          # Packaging verification and server build scripts
│   ├── after-pack.js                 # Electron builder post-packaging hook
│   └── verify-terminal.ts            # Terminal verification helper script
├── server.ts                         # Main HTTP server entry point and WebSocket attachment
├── src/
│   ├── app/                          # Next.js App Router (pages and API route handlers)
│   │   ├── api/                      # REST API endpoints (ai, deck, history, settings, workspaces)
│   │   ├── globals.css               # Global application styling rules
│   │   ├── layout.tsx                # Root layout component
│   │   ├── page.tsx                  # Primary workspace dashboard page
│   │   └── timeline/                 # Timeline activity session route
│   ├── components/                   # Core application layout and general UI primitives
│   │   ├── layout/                   # App Shell, Developer Hub, and Workspace layout
│   │   └── ui/                       # Generic UI button, dialog, modal, and input primitives
│   ├── features/                     # Feature-sliced domain modules
│   │   ├── ai/                       # AI provider implementations (Gemini, OpenAI)
│   │   ├── command-deck/             # Visual Command Deck management hooks and UI
│   │   ├── command-history/          # Command history search, filtering, and storage hooks
│   │   ├── command-palette/          # Command Palette modal and search index
│   │   ├── settings/                 # User preferences and provider settings UI
│   │   ├── terminal/                 # xterm.js integration, presentation, and WebSocket client
│   │   ├── timeline/                 # Timeline view session grouping and display components
│   │   └── workspaces/               # Workspace creation, switching, and deletion UI
│   ├── server/                       # Server-only implementation code
│   │   ├── ai/                       # Backend AI service and encrypted credential store
│   │   ├── db/                       # Drizzle ORM schema, SQLite client, and repositories
│   │   ├── terminal/                 # node-pty adapter and terminal session manager
│   │   └── websocket/                # WebSocket server and Terminal Gateway
│   └── shared/                       # Shared contracts, domain types, and template parsers
│       ├── command-template/         # Command variable parsing and template expansion
│       ├── contracts/                # Shared API and WebSocket payload contracts
│       ├── schemas/                  # Runtime validation schemas (Zod)
│       └── types/                    # Shared TypeScript interfaces
└── tests/                            # Automated test suite
    ├── integration/                  # Database repository integration tests
    └── unit/                         # Client, server, and shared library unit tests
```

---

## 8. How the Application Works

1. **Application Launch**: When the user opens CommandDeck, Electron displays a lightweight splash window while spawning the Node.js server (`server.ts`) in the background on local port `3000`. Once the server readiness check succeeds, the main window loads the Next.js application interface.
2. **Workspace & Terminal Initialization**: Upon loading, CommandDeck retrieves the active workspace configuration from the SQLite database. Opening a terminal tab triggers a WebSocket request to `TerminalWebSocketServer`, which initializes a background system shell (`zsh`, `bash`, `cmd`, or `powershell`) using `node-pty`.
3. **Real-time Terminal Interaction**: Keystrokes typed into the `xterm.js` browser view are forwarded over WebSocket to the `node-pty` process. Standard output and error streams generated by shell execution are streamed back instantly and rendered on screen.
4. **Automated Command Logging**: As commands are executed inside the terminal, shell integration hooks record the command string, working directory, start time, end time, duration, and exit status into the `command_history` database table.
5. **Deck Pinning & Parameterization**: Developers can browse their command history and save frequently executed commands to their Command Deck. Commands can include template placeholders (e.g., `git checkout {{branch}}`), prompting the user for parameter values prior to execution.
6. **AI Commit Generation**: In the Developer Hub, users can inspect git repository status. Clicking "Generate Commit Message" prompts the backend AI service to fetch staged git diffs and request a commit summary from configured AI providers (Google Gemini or OpenAI).

---

## 9. Contributions Summary

Based on the codebase analysis and repository implementation, the following key engineering contributions were delivered:

- **System Architecture & Server Core**: Architected the local-first application composition, establishing the custom Node.js server (`server.ts`) combining Next.js page serving and WebSocket terminal gateways.
- **Relational Database Design**: Designed and implemented the complete SQLite schema using Drizzle ORM across 6 primary tables (`settings`, `workspaces`, `workspace_terminal_state`, `command_history`, `command_definitions`, `command_deck_items`).
- **Terminal & Process Integration**: Integrated `node-pty` with `@xterm/xterm` over WebSockets, engineering real-time terminal output streaming and shell execution tracking.
- **Feature Development**: Built feature modules under `src/features/`, including the visual Command Deck, searchable Command History, Command Palette modal (`Cmd+K`), Timeline activity view, and Settings preferences dialog.
- **AI Provider Service**: Implemented the modular backend AI service (`src/server/ai/`) and frontend integration (`src/features/ai/`), connecting Google Gemini and OpenAI APIs for automated git commit message drafting.
- **Template Engine**: Developed the command template parser (`src/shared/command-template`) supporting dynamic variable extraction, validation, and placeholder substitution.
- **Native Desktop Build & Packaging**: Engineered Electron main process window management (`electron/main.ts`), custom splash loader, native application menus, auto-updater integration, and `electron-builder` multi-platform build scripts.
- **Automated Testing Suite**: Authored 25 test suites containing 90 unit and integration tests verifying database repositories, terminal contracts, template parsing, and state managers.

---

## 10. Implementation Evidence

### 1. Database Schema (`src/server/db/schema.ts`)
The application defines six relational database tables using Drizzle ORM:
- `settings`: Stores global key-value application settings.
- `workspaces`: Contains workspace identifiers and names with unique index constraints.
- `workspace_terminal_state`: Tracks current working directory (`cwd`) per workspace.
- `command_history`: Logs executed commands, workspace IDs, exit codes, durations, start/end timestamps, and completion reasons.
- `command_definitions`: Reusable command templates derived from history entries.
- `command_deck_items`: User-pinned commands displayed on the visual deck with display names and ordering positions.

### 2. Backend REST API Routes (`src/app/api/`)
- `/api/workspaces`: CRUD endpoints for workspace management.
- `/api/history`: Search, list, and retrieve command execution logs.
- `/api/deck`: Manage pinned Command Deck items and display ordering.
- `/api/commands`: Execute and manage saved command definitions.
- `/api/git`: Query git repository status, branches, and diff outputs.
- `/api/ai`: Trigger AI-assisted commit message generation and provider connection tests.
- `/api/settings`: Read and update user preferences and AI provider configuration.

### 3. Real-Time Terminal Gateway (`src/server/websocket/`)
- `TerminalWebSocketServer`: Manages client WebSocket connections, cookie-based session verification (`randomBytes`), and message routing.
- `pty-adapter.ts`: Wraps `node-pty` to spawn native platform shell processes with PTY resizing support (`cols`, `rows`).

### 4. AI Provider Integration (`src/features/ai/providers/`)
- `gemini-provider.ts`: Integrates with Google Gemini models to construct prompts from git diffs and return structured commit messages.
- `openai-provider.ts`: OpenAI API provider adapter implementing the standardized AI provider contract interface.
- `credential-store.ts`: Local server-side store for managing API credentials securely.

### 5. Automated Test Suite (`tests/`)
Verification output demonstrating 100% test pass rate across 25 test files (90 total tests):
- Unit Tests: Client state (`command-palette`, `timeline`, `settings`), shared libraries (`command-template`, `diff-preparation`), and server modules (`credential-store`, `update-service`, `terminal-contract`).
- Integration Tests: Database operations (`command-history-and-deck.test.ts`, `settings.test.ts`).

---

## 11. Challenges Addressed

1. **Electron Recursive App Spawning**: When launching background server scripts in packaged Electron apps on macOS, standard process spawning with `process.execPath` caused Electron binaries to launch recursive GUI windows. This was resolved by migrating to Electron's official `utilityProcess.fork` API to run `.server/server.js` in a headless Node runtime.
2. **High-Frequency Terminal Buffer Streaming**: Updating React or Zustand global state on every terminal output chunk introduced UI rendering lag. This was solved by decoupling PTY stream updates from React state, piping output directly into the `xterm.js` canvas instance while keeping higher-level state strictly for metadata.
3. **Stale Lock File Recovery**: Development server crashes could leave behind lock files (`.next/dev/lock`), preventing subsequent server launches. The Electron startup routine was enhanced to detect and remove stale lock files automatically after confirming port availability.
4. **Cross-Platform PTY & Shell Parsing**: Terminal command execution behavior varies across operating systems (`zsh` on macOS, `cmd`/`powershell` on Windows). The system handles cross-platform environment variables and shell paths dynamically.

---

## 12. Learning Outcomes

- **Full-Stack Desktop Engineering**: Learned how to combine Electron native desktop bindings with Next.js web applications and Node.js server background processes.
- **Real-Time Systems & Terminal Emulation**: Gained hands-on experience with WebSocket protocol design, bidirectional event streaming, and browser canvas terminal rendering via `xterm.js`.
- **Local Database Architecture**: Developed skills in designing lightweight relational database schemas, migrations, and repository abstractions using SQLite and Drizzle ORM.
- **Feature-Sliced Design**: Applied modular frontend architecture principles (`src/features/`), separating domain features into independent components, hooks, and types.
- **AI Service Integration**: Mastered integrating external LLM APIs (Google Gemini, OpenAI) into application workflows, including prompt formatting, diff sanitization, and error handling.
- **Automated Testing & Release Packaging**: Built comprehensive unit/integration test pipelines with Vitest and configured multi-platform packaging via `electron-builder`.

---

## 13. Conclusion

CommandDeck demonstrates a modern, local-first visual terminal workspace application built for software developers. By unifying multi-tab terminal management, automatic command history persistence, parameterized command decks, and AI-assisted git integration into a polished desktop application, CommandDeck resolves the fragmentation of traditional command-line environments. The project is fully implemented, thoroughly tested with 90 passing automated tests, and ready for production desktop release.
