# CommandDeck

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black.svg)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A local-first visual terminal workspace with structured history, curated command decks, and workspace isolation.

CommandDeck transforms the command-line interface from a volatile text buffer into a structured, persistent workspace. By pairing an xterm.js terminal with a local Node.js runtime, SQLite storage, and streaming shell integration markers, CommandDeck captures terminal executions into structured history, empowers developers to curate reusable command decks, and maintains strict project isolation without compromising native shell behavior or sending data outside your machine.

---

## Screenshots

![Terminal Workspace](docs/images/terminal.png)

![Command History & Developer Hub](docs/images/history.png)

![Command Palette](docs/images/command-palette.png)

---

## Features

### Terminal

- **xterm.js Rendering**: Canvas-rendered terminal surface with automatic viewport fitting via `@xterm/addon-fit`.
- **Native PTY Execution**: Background process management powered by `node-pty` attached over authenticated loopback WebSockets (`ws`).
- **OSC Shell Integration**: Streaming zsh integration parser that captures exact command text, start/end timestamps, exit codes, and execution duration without regex prompt matching.
- **Working Directory Persistence**: Automatically tracks and restores the last shell-reported working directory (`cwd`) per workspace upon restart or tab replacement.
- **Clean Terminal Presentation**: Abbreviated cwd prompt configuration and buffer decoration markers anchored to completed command boundaries.

### Workspace Management

- **Context Isolation**: Isolates terminal sessions, command history, decks, and timelines per workspace to prevent cross-project context leakage.
- **Workspace Lifecycle**: Create, rename, switch, and delete workspaces dynamically.
- **Automatic Migration**: Automatically initializes a default workspace and migrates legacy unassigned data.

### Command History

- **Immutable SQLite Storage**: Durable execution history managed with Drizzle ORM and `better-sqlite3`.
- **Rich Execution Metadata**: Captures command string, working directory, exit code, execution timestamps, duration, and completion status (`shell` vs. `session-exit`).
- **Structured Filtering & Search**: Instant filtering by status (`success`, `failed`, `interrupted`) combined with text search across history records.
- **Virtualized Rendering**: High-performance history list rendering optimized for thousands of historical records.
- **One-Touch Actions**: Re-run commands directly in the active terminal or copy command text/output.

### Command Deck

- **Curated Command Cards**: Workspace-specific library of persistent, reusable command definitions.
- **History Provenance**: Add commands directly from execution history while preserving tracking links back to the original execution.
- **Card Management**: Custom display titles, descriptions, position reordering, deletion, and direct terminal execution.

### Templates

- **Parameterized Definitions**: Command cards supporting placeholder syntax using `{{variable}}` notation (e.g. `docker run -p {{port}}:80 {{image}}`).
- **Variable Parsing**: Automatic regex-backed variable detection (`[A-Za-z_][A-Za-z0-9_]*`).
- **Interactive Resolution**: Modal prompt for inputting variable values prior to terminal execution.
- **Safe Execution**: Generates live command previews and executes expanded strings without mutating stored template definitions.

### Timeline

- **Chronological Feed**: Dedicated `/timeline` view displaying command streams for the active workspace.
- **Activity Session Grouping**: Dynamic grouping based on inactivity gaps (>15 minutes) or project working directory shifts.
- **Collapsible Sessions & Chunking**: Collapsible session containers with chunked rendering (100 items per chunk) for smooth scrolling.
- **Timeline Actions**: Quick actions to copy commands, add entries to the Deck, or re-run in the active terminal session.

### Developer Hub

- **Terminal-First Layout**: Dominant xterm workspace layout paired with an extendable Developer Hub side panel.
- **Responsive Docking**: Desktop right-hand side panel that collapses to a bottom panel on smaller viewports.
- **State-Preserving Navigation**: Tabbed switching between Command Deck and Command History that preserves search inputs, filter selections, and scroll positions.

### Command Palette

- **Keyboard-First Access**: Accessible anywhere in the application via `Cmd+K` / `Ctrl+K`.
- **Global Event Interception**: Capture-phase keyboard listener preventing shortcut forwarding to xterm.
- **Registry Search Engine**: Searches registered actions across workspace selection, deck execution, history queries, templates, and app navigation with deterministic match scoring (exact, prefix, substring).

---

## Why CommandDeck?

Modern software engineering requires running dozens of complex terminal commands daily—ranging from build scripts and container commands to database migrations and test suites. Traditional terminal emulators treat shell sessions as volatile text buffers: history search (`Ctrl+R`) is cumbersome, past outputs are lost when buffers reset, and frequently used commands are buried in shell history files or local scratchpads.

CommandDeck bridges the gap between raw terminal efficiency and visual workspace tools:

- **Reduces Repetitive Work**: Frequently executed commands can be saved into structured Decks or parameterized Templates, eliminating manual retyping and flag lookups.
- **Preserves Native Workflow**: Runs genuine local shell processes (`zsh`) with full environment, PATH, and permissions intact.
- **Guarantees Data Privacy**: Operates entirely local-first. Terminal output and command history reside exclusively in a local SQLite database bound to loopback (`127.0.0.1`).
- **Maintains Project Context**: Workspaces keep command histories and curated decks isolated by project, eliminating context mixing across client repositories or microservices.

---

## Installation

### Prerequisites

- **Node.js**: `>= 22.0.0`
- **npm**: `>= 11.0.0`
- **OS**: macOS (Reference platform with `zsh`)

### Step-by-Step Setup

1. **Clone the repository**:

   ```bash
   git clone https://github.com/7ochan/CommandDeck.git
   cd CommandDeck
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Configure environment (Optional)**:

   ```bash
   cp .env.example .env
   ```

   _By default, the server binds to `127.0.0.1:3000` and stores data in the operating system's application data directory. Customize `PORT` or `COMMANDDECK_DATA_DIR` in `.env` if desired._

4. **Start Development Server**:

   ```bash
   npm run dev
   ```

   Open `http://127.0.0.1:3000` in your browser.

5. **Build and Run Production Server**:
   ```bash
   npm run build
   npm start
   ```

---

## Usage

### Workspace Management

Select or create workspaces using the header context menu. Workspaces maintain independent terminal working directories, command histories, command decks, and timeline streams. Switch workspaces at any time to switch project context without terminating background processes or mixing history records.

### Command History

View live and historical executions in the Developer Hub side panel. Use the search input or status filters (`Success`, `Failed`, `Interrupted`) to locate past executions. Click any entry to inspect execution timing, duration, exit status, or working directory. Re-run commands with a single click or copy command strings and outputs to your clipboard.

### Command Deck

Organize your core workflows by saving frequently used commands to the Command Deck. Click **+ Add to Deck** from any history entry or create a custom card. Reorder cards by dragging or updating positions, edit titles and descriptions, and execute cards directly into the active terminal.

### Templates

Define reusable command templates containing variables wrapped in double curly braces (e.g., `git checkout -b {{feature_branch}}`). Clicking a template card opens a resolution modal that prompts for required variable inputs, displays a live preview of the expanded command string, and executes it in the terminal without modifying the underlying template definition.

### Command Palette

Press `Cmd+K` (macOS) or `Ctrl+K` (Linux/Windows) to trigger the Command Palette. Instantly search and execute registered actions including:

- Workspace switching
- Deck command execution
- Template variable resolution
- History entry lookups
- Application navigation (`Terminal`, `Timeline`)

### Timeline

Navigate to `/timeline` to view a chronological stream of command activity across the active workspace. Command executions are automatically grouped into Activity Sessions based on 15-minute inactivity intervals or working directory changes. Expand session cards to review batch-rendered event logs, copy commands, or send runs back to the active terminal.

---

## Project Architecture

CommandDeck is structured as a single deployable application where a custom Node.js server acts as the central composition root. The Node.js process hosts Next.js for page rendering and HTTP route handlers while running an authenticated WebSocket gateway attached to native `node-pty` pseudoterminal processes.

```text
Browser
┌────────────────────────────────────────────────────────────┐
│ Next.js / React 19 Client                                  │
│                                                            │
│  xterm.js Viewport  Command History  Command Deck          │
│          │                 │                │              │
│          └───── Client State / Local Hooks ─┘              │
└──────────────┬───────────────────────┬─────────────────────┘
               │ WebSocket             │ HTTP API
               │ live streaming        │ durable queries
               ▼                       ▼
Local Node.js Process (127.0.0.1)
┌────────────────────────────────────────────────────────────┐
│ Custom HTTP Server + Next.js Handler                       │
│                                                            │
│  WebSocket Gateway    API Handlers    Repositories         │
│          │                 │                │              │
│          ▼                 ▼                ▼              │
│  Terminal Manager   Command Capture   SQLite + Drizzle     │
│          │                 │                │              │
│          └───── OSC Integration Parser ─────┘              │
│          │                                  │              │
│       node-pty                        better-sqlite3       │
└──────────┬─────────────────────────────────────────────────┘
           ▼
   Local Shell (zsh)
```

### Technology Stack

| Layer / Component      | Technology                                          | Description                                                |
| ---------------------- | --------------------------------------------------- | ---------------------------------------------------------- |
| **Frontend Framework** | Next.js 16 (App Router), React 19                   | Responsive client interface and server-rendered API routes |
| **Terminal Emulator**  | `xterm.js` 6.0 (`@xterm/xterm`, `@xterm/addon-fit`) | Canvas terminal rendering with dynamic resize fitting      |
| **Server Runtime**     | Node.js (Custom HTTP Server)                        | Single-process composition root bound to loopback          |
| **PTY Management**     | `node-pty` 1.2                                      | Native OS pseudoterminal process spawner                   |
| **Real-time Protocol** | `ws` 8.21                                           | Low-latency, bi-directional WebSocket streaming            |
| **Database & Storage** | SQLite 3 (`better-sqlite3`)                         | Local-first relational database storage                    |
| **ORM & Migrations**   | Drizzle ORM 0.45                                    | Type-safe database queries and automated schema migrations |
| **Data Validation**    | Zod 4.4                                             | Schema validation for HTTP endpoints and WebSocket events  |
| **Test Runner**        | Vitest 4.1                                          | Unit and integration test suite                            |

---

## Roadmap

Planned future features as outlined in the development roadmap:

- **Workflows**: Multi-step command pipelines with variable bindings, step execution history, and configurable stop-on-failure rules.
- **AI Assistant**: Local context-aware command suggestions and error diagnosis.
- **Settings & Preferences UI**: Graphical interface for shell profile configuration, custom prompt settings, and private history exclusions.
- **Electron Desktop App**: Cross-platform desktop application package with native OS window management.
- **Auto Updates**: Integrated update mechanism for desktop distributions.
- **Broader Shell Support**: First-class shell integration support for Bash, Fish, and Windows PowerShell (ConPTY).

---

## Development

### Useful Commands

| Command                   | Purpose                                                                 |
| ------------------------- | ----------------------------------------------------------------------- |
| `npm install`             | Install project dependencies                                            |
| `npm run dev`             | Start development server in watch mode                                  |
| `npm test`                | Execute unit and integration tests via Vitest                           |
| `npm run typecheck`       | Perform TypeScript type checking without emitting files                 |
| `npm run lint`            | Run ESLint checks across the codebase                                   |
| `npm run lint:fix`        | Apply safe automated ESLint fixes                                       |
| `npm run format`          | Format code with Prettier                                               |
| `npm run format:check`    | Verify code formatting compliance                                       |
| `npm run build`           | Build Next.js application and compile custom Node.js server             |
| `npm start`               | Launch compiled production server                                       |
| `npm run check`           | Run complete verification suite (format, lint, typecheck, tests, build) |
| `npm run verify:terminal` | Run end-to-end terminal persistence and verification script             |

---

## Contributing

Contributions, feedback, and bug reports are welcome. Feel free to open an issue or submit a pull request on GitHub.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure all tests pass (`npm run check`) before submitting pull requests.

---

## License

This project is licensed under the [MIT License](LICENSE).
