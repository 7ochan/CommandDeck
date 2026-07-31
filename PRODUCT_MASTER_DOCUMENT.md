# CommandDeck: Product Master Document (PRD)

> **The Single Source of Truth for CommandDeck**  
> *A local-first visual terminal workspace with structured command history, curated command decks, workspace context isolation, and native shell execution.*

---

## Executive Summary & Product Overview

### What is CommandDeck?
**CommandDeck** is a modern, local-first visual terminal workspace engineered for developers, DevOps engineers, and command-line power users. It bridges the gap between raw terminal performance and high-productivity visual workspace tools.

Traditional terminal emulators treat shell sessions as ephemeral text buffers—where history search (`Ctrl+R`) is fragmented, past execution outputs disappear upon buffer reset, and frequently used scripts are buried in shell history files or temporary scratchpads.

CommandDeck transforms the terminal from a volatile text buffer into a structured, persistent workspace. By coupling an **xterm.js** terminal rendering engine with a local **Node.js** runtime, **SQLite** persistence via **Drizzle ORM**, and **OSC 633 streaming shell integration markers**, CommandDeck captures every executed command into structured history, empowers developers to curate reusable Command Decks, and maintains strict project context isolation without sending data outside the user's local machine or compromising native shell behavior.

```text
                               ┌────────────────────────────────────────────────────────┐
                               │                    CommandDeck App                     │
                               │                                                        │
┌──────────────────┐           │  ┌──────────────────┐    ┌──────────────────────────┐  │
│                  │           │  │                  │    │      Developer Hub       │  │
│   Native Shell   │◄──────────┼─►│  xterm.js Canvas │    ├──────────────────────────┤  │
│  (zsh / pty)     │  OSC 633  │  │ Terminal Engine  │    │  Command History (Audit) │  │
│                  │  Streams  │  │                  │    │  Command Deck (Curated)  │  │
└──────────────────┘           │  └──────────────────┘    └──────────────────────────┘  │
                               │               ▲                       ▲                │
                               │               └─────── SQLite DB ─────┘                │
                               │                   (127.0.0.1 Loopback)                 │
                               └────────────────────────────────────────────────────────┘
```

### High-Level Value Proposition
1. **Zero Context Loss**: Every executed command, working directory, timestamp, exit code, and execution duration is captured automatically into immutable, searchable history.
2. **Curated Workflows (Command Deck)**: Promotes useful commands from history into persistent, reusable "Cards" and parameterized "Templates" with `{{variable}}` substitution.
3. **Workspace Isolation**: Projects, terminal sessions, history streams, and curated decks remain isolated per workspace—preventing cross-project context leaks.
4. **100% Local-First & Private**: Operates exclusively on loopback (`127.0.0.1`). Terminal output, environment state, and command logs never leave the developer's hardware.
5. **Native Shell Integrity**: Preserves full shell environment, startup files (`.zshrc`), `PATH`, subshells, alias configurations, and interactive PTY binaries (`vim`, `htop`, `ssh`).

---

## Mission, Vision & Core Philosophy

### Mission Statement
To eliminate repetitive manual command typing, context-switching overhead, and volatile scrollback limits by turning command-line interaction into a structured, visual, and persistent workspace.

### Product Vision
To redefine the desktop command-line interface into a context-aware developer operating environment where past executions are instantly searchable, repetitive commands are effortlessly templated, and multi-project workflows remain perfectly isolated.

### Product Principles
1. **Workspace is the Root Context**: Every terminal session, history record, command deck item, and timeline feed belongs explicitly to a Workspace.
2. **Terminal Reliability Above All**: Visual components and UI layers must never compromise shell rendering accuracy, PTY process lifecycle, resize handling, or interactive terminal programs.
3. **Local-First & Privacy Preserving**: Zero telemetry, zero cloud dependencies. Your code, command lines, and secrets stay on your machine.
4. **Deliberate User Control**: Command executions and quick actions are explicit and visible. The system never executes background commands silently.
5. **Build Depth Before Breadth**: Prioritize rock-solid terminal capture, fast search, and deck curation before speculative extensions or cloud features.

---

## Problems Being Solved

| Problem in Standard Terminals | CommandDeck Solution |
| :--- | :--- |
| **Volatile Scrollback Buffers**: Terminal buffer limits cause past command outputs, build logs, and error stack traces to be lost forever upon terminal clear or buffer overwrite. | **Durable SQLite History**: Every execution is saved into a local SQLite database with start/end timestamps, exit codes, exact working directories, and execution durations. |
| **Cumbersome Shell History Search**: `Ctrl+R` and `history` commands are linear, unformatted, obscure error codes, and fail to filter by project context. | **Structured Filtering & Search**: Instant literal substring and multi-attribute filtering (Success, Failed, Interrupted) with visual line highlighting and virtualized rendering. |
| **Repetitive Retyping of Complex Commands**: Developers repeatedly retype long `docker run`, `kubectl`, `git`, and database migration strings or maintain informal scratchpads. | **Curated Command Deck**: Save frequently used commands into a persistent, drag-and-drop ordered deck with custom names, descriptions, and variable templates (`{{var}}`). |
| **Cross-Project Context Mixing**: Shell history files (`.zsh_history`) mix commands executed across completely different projects, clients, and repositories. | **Strict Workspace Isolation**: Isolates terminal sessions, saved directories, history logs, and curated decks per project workspace. |
| **Security & Privacy Risks in Cloud Terminals**: Modern AI-first terminals stream terminal input, output, and environment variables to third-party cloud servers. | **127.0.0.1 Loopback Architecture**: Operates 100% locally. WebSocket connections are authenticated over loopback and database files reside in local app data directories. |

---

## Target Audience & User Personas

### 1. The Full-Stack / Software Engineer
* **Profile**: Builds web apps, APIs, and microservices across multiple git repositories.
* **Pain Point**: Constantly switching between project directories, executing dev servers (`npm run dev`), running migrations, and losing track of test command flags.
* **CommandDeck Usage**: Uses **Workspaces** to separate client projects; creates **Command Deck Templates** for database resets and branch checkouts.

### 2. The DevOps / SRE / System Administrator
* **Profile**: Manages infrastructure, container builds, Kubernetes clusters, and cloud deployments.
* **Pain Point**: Retyping long, error-prone `docker`, `podman`, `kubectl`, and `terraform` commands with complex parameter flags.
* **CommandDeck Usage**: Leverages **Parameterized Templates** (`docker run -p {{port}}:80 {{image}}`) to safely preview and execute container deployment scripts.

### 3. The CLI Power User & Maintainer
* **Profile**: Lives in the terminal, managing open-source repositories, release scripts, and automated builds.
* **Pain Point**: Hard to track command execution duration and exit statuses when running sequential build and test suites.
* **CommandDeck Usage**: Uses **Workspace Timeline** (`/timeline`) to review activity sessions grouped by time gaps and working directory shifts.

---

## Complete Feature Breakdown

### 1. Terminal Workspace & PTY Execution
* **xterm.js Canvas Engine**: High-performance canvas-based terminal emulator powered by `@xterm/xterm` (v6.0.0) and `@xterm/addon-fit` (v0.11.0) for auto-fitting viewport adjustments.
* **Native PTY Process Spawning**: Low-level OS process management via `node-pty` (v1.2.0-beta.14) bound to real user shell binaries (`zsh`).
* **OSC 633 Shell Integration Parser**: Streaming, nonce-authenticated state machine parsing structured Operating System Commands (OSC) directly from the zsh PTY stream:
  * `\e]633;A;nonce\a` — Prompt Start boundary.
  * `\e]633;B;nonce\a` — Prompt End boundary.
  * `\e]633;P;Cwd=<dir>;nonce\a` — Working Directory update.
  * `\e]633;E;<command>;nonce\a` — Exact command line string execution.
  * `\e]633;C;nonce\a` — Command Start / Execution running.
  * `\e]633;D;<exit_code>;nonce\a` — Command Completion with exit status code.
* **Abbreviated Zsh Prompt Presentation**: Injected presentation module providing a compact, clean prompt containing the abbreviated working directory and a sleek `❯` command indicator.
* **xterm-Anchored Section Separators**: Completed commands are visually separated using text-free, pointer-inert xterm decoration markers attached to completion boundaries—eliminating visual clutter without corrupting terminal scrollback or text selection.
* **Working Directory (CWD) Persistence**: Automatically tracks and restores the last shell-reported working directory per workspace upon application restart or tab switching.

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Workspace: CommandDeck (main)                            [Status: Connected ●] [⚙] [⌘K] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ~/desktop/cmd-deck ❯ npm run check                                                     │
│                                                                                        │
│ > command-deck@0.1.13 check                                                            │
│ > npm run format:check && npm run lint && npm run typecheck && npm test && npm run...  │
│                                                                                        │
│ ✔ Format check passed                                                                  │
│ ✔ ESLint check passed                                                                  │
│ ✔ TypeScript check passed                                                              │
│ ❯ Tests: 42 passed (42)                                                                │
│ ────────────────────────────────────────────────────────────────────────────────────── │
│ ~/desktop/cmd-deck ❯ _                                                                 │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2. Workspace Context Isolation
* **Durable Project Boundaries**: Workspaces act as the root container for terminal working directories, command histories, command decks, and timeline streams.
* **Workspace Lifecycle**: Complete support to create, rename, switch, and delete workspaces while maintaining at least one active default workspace (`Default Workspace`).
* **Session Termination Safety**: Switching workspaces cleanly detaches the active PTY session, preserves incomplete execution logs under the originating workspace, and initializes a new terminal session bound to the destination workspace's launch configuration.
* **Automatic Schema Migration**: Upgrades legacy unassigned databases seamlessly by creating a default workspace and re-associating foreign keys.

### 3. Immutable Command History
* **SQLite Persistence**: Managed via **Drizzle ORM** (`drizzle-orm` v0.45.2) and **better-sqlite3** (v13.0.1) in local storage (`settings.db` / `commanddeck.db`).
* **Rich Execution Audit**: Records exact command string, working directory (`cwd`), exit code (`0` for success, `130` for SIGINT interruption, non-zero for failure), execution start timestamp, completion timestamp, duration in milliseconds, and completion reason (`shell` vs. `session-exit`).
* **Real-time Status Classification**:
  * `Success`: Exit code 0.
  * `Failed`: Non-zero exit code.
  * `Interrupted`: Exit code 130 or terminated by session exit / workspace switch.
* **Search & Multi-Filter Engine**: Live, debounced literal case-insensitive substring search across command text and working directory combined with structured status toggle filters.
* **Virtualized Rendering**: High-performance UI rendering optimized to smooth-scroll through thousands of historical executions without DOM lag.
* **One-Touch Actions**: Re-run command in active terminal, copy command text, copy output, or add entry directly to the Command Deck.

### 4. Curated Command Deck
* **Workspace & Global Decks**: Reusable library of curated commands explicitly chosen by the user.
* **History Provenance Tracking**: Items added from History retain foreign key links (`sourceHistoryId`) back to the original execution record for auditability without mutating past history logs.
* **Card Management**: Display custom title, detailed description, drag-and-drop position reordering, deletion, and single-click execution.
* **Command Definition Decoupling**: Editing a Deck item's display name or command text modifies only the `command_definitions` and `command_deck_items` tables—never altering past execution records.

### 5. Parameterized Command Templates
* **Variable Syntax Engine**: Supports placeholder syntax using double curly brace notation (e.g. `git checkout -b {{feature_branch}}` or `docker run -p {{port}}:80 {{image}}`).
* **Regex Variable Parsing**: Automatic detection of valid placeholders using case-sensitive token parsing (`[A-Za-z_][A-Za-z0-9_]*`).
* **Interactive Resolution Modal**: When a template card is clicked, an interactive modal prompts the user for distinct variable values, deduplicating repeated placeholders by first occurrence.
* **Live Command Preview & Safe Execution**: Renders an instant preview of the substituted command string and executes it into the active terminal without mutating the saved template definition.

```text
┌────────────────────────────────────────────────────────┐
│ Execute Command Template                               │
├────────────────────────────────────────────────────────┤
│ Template: docker run -p {{port}}:80 {{image}}          │
│                                                        │
│ [ port ]  ->  8080                                     │
│ [ image ] ->  nginx:latest                             │
│                                                        │
│ Live Preview:                                          │
│ $ docker run -p 8080:80 nginx:latest                   │
│                                                        │
│                          [ Cancel ]  [ Execute in PTY ]│
└────────────────────────────────────────────────────────┘
```

### 6. Searchable Workspace Timeline
* **Dedicated Route (`/timeline`)**: Chronological stream of command executions scoped to the active workspace.
* **Dynamic Activity Session Grouping**: Automatically clusters consecutive command executions into collapsible "Activity Sessions" based on 15-minute inactivity intervals or shifts in the normalized working directory context.
* **Collapsible Sessions & Chunked Rendering**: Renders sessions in bounded DOM chunks (100 items per chunk) to deliver smooth scrolling across deep project histories.
* **Timeline Quick Handoff**: One-click actions to copy commands, add to Deck, or re-run in the active terminal session via a state-preserving navigation handoff.

### 7. Developer Hub Side Panel
* **Terminal-First Layout**: Dominant terminal canvas layout paired with an extendable right-hand side panel.
* **State-Preserving Tab Handoff**: Tabbed navigation switching between **Command Deck** and **Command History** that retains search input state, filter selections, open dialogs, and scroll positions by keeping both tab panels mounted in an inert DOM state.
* **Responsive Docking**: Collapses beneath the terminal view on mobile/tablet viewports while preserving complete functionality.

### 8. Keyboard-First Command Palette
* **Global Access (`Cmd+K` / `Ctrl+K`)**: Accessible from anywhere in the application overlaying a dark glassmorphic modal.
* **Capture-Phase Keyboard Interception**: Instantly captures keypresses prior to xterm's input handlers, preventing accidental character sends to active terminal sessions.
* **Multi-Source Action Registry**: Searches across active workspace selection, deck execution, template resolution, history lookups, settings access, and view navigation.
* **Deterministic Rank Scoring**: Multi-pass search engine bucketing query matches into `exact`, `prefix`, and `substring` results with stable priority ordering and bounded result counts.

```text
┌────────────────────────────────────────────────────────┐
│ 🔍 Type a command or search... (Cmd+K)                 │
├────────────────────────────────────────────────────────┤
│ Navigation                                             │
│   > Switch to Timeline View                            │
│   > Open Settings                                      │
│ Workspace                                              │
│   > Switch Workspace: CommandDeck                      │
│ Command Deck                                           │
│   > Run: Start Next.js Dev Server (npm run dev)        │
│   > Template: Docker Run Container...                  │
└────────────────────────────────────────────────────────┘
```

### 9. Application Settings & Customization
* **Central Settings Modal (`Cmd+,` / `Ctrl+,`)**: Accessible from header or Command Palette.
* **Typed Leaf Persistence in SQLite**: Stores settings key-value pairs in SQLite (`settings` table) as JSON strings with fallback to versioned TypeScript defaults.
* **Customizable Preferences**:
  * **General**: Restore previous workspace, confirm workspace deletion, auto-focus terminal after switching, show/hide sidebars, automatic update checks.
  * **Terminal**: Font size (10px–24px, default 14px), cursor style (`bar`, `block`, `underline`), cursor blink toggle, scrollback buffer size (1,000–100,000 lines, default 5,000), directory accent color (`cyan`, `emerald`, `purple`, `amber`, `coral`, `blue`, `magenta`).
  * **Appearance**: Visual theme (`dark`, `light`, `system`).
  * **Developer Hub**: Remember last tab, show history tab, deck scope (`workspace` vs `global`).
  * **Keybindings**: Custom keyboard shortcut mappings with platform-aware modifier key display (`⌘`, `⌥`, `⇧`, `Ctrl`).
  * **AI Provider Configuration**: Integrated setup for local or cloud AI providers (`gemini`, `openai`, `anthropic`, `ollama`).

### 10. Native Desktop Integration (Electron Package)
* **Cross-Platform Packaging**: Built with **Electron** (v43.2.0) and **electron-builder** (v26.15.3) for macOS (`.dmg`, `.zip`), Windows (`.exe` NSIS, portable), and Linux (`.AppImage`).
* **Child Process Architecture**: Electron main process spawns the production custom Node.js server as a subprocess, maintaining complete separation between app window rendering and server services.
* **Native Desktop Polish**: Window bounds/state auto-saving every 30 seconds, native application menus, startup loading window, renderer crash recovery dialogs, and automatic update checks via **electron-updater** and GitHub Releases.

---

## User Journey & Core Workflows

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                USER WORKFLOW JOURNEY                                    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │  1. Launch CommandDeck    │
                               │  (App restores last CWD)  │
                               └─────────────┬─────────────┘
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │ 2. Select / Create        │
                               │    Workspace (e.g. App)   │
                               └─────────────┬─────────────┘
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │ 3. Execute Terminal       │
                               │    Commands in PTY        │
                               └─────────────┬─────────────┘
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │ 4. OSC Parser Captures    │
                               │    History to SQLite      │
                               └─────────────┬─────────────┘
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │ 5. Developer Hub          │
                               │    Search & Audit Logs    │
                               └─────────────┬─────────────┘
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │ 6. Add Essential Commands │
                               │    to Command Deck        │
                               └─────────────┬─────────────┘
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │ 7. Parameterize Templates │
                               │    with {{variables}}     │
                               └─────────────┬─────────────┘
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │ 8. Re-run via Deck or     │
                               │    Cmd+K Command Palette  │
                               └───────────────────────────┘
```

1. **Onboarding & Initialization**: User launches CommandDeck (Web or Electron Desktop App). The app loads the user's active workspace, connects to the local Node.js server over authenticated WebSockets, and restores the terminal working directory.
2. **Executing Native Commands**: User types shell commands in xterm.js. The zsh OSC 633 streaming parser captures command execution bounds, duration, exit code, and working directory in real-time.
3. **Reviewing History & Auditing**: User opens the Developer Hub side panel or navigates to `/timeline` to inspect recent command execution logs, filter by failed commands, or copy outputs.
4. **Curating the Command Deck**: User clicks **+ Add to Deck** on a frequently used history entry (e.g. `docker-compose up -d`). The command is saved to the Deck with a custom display name and description.
5. **Executing Templates**: User runs a parameterized template (`git checkout -b {{branch}}`). The resolution modal appears, prompts for `branch`, shows a live string preview, and executes it directly in the active terminal pane.
6. **Keyboard Navigation**: User presses `Cmd+K` to search workspaces, jump to timeline, or execute deck items without touching the mouse.

---

## Technical Architecture Overview

CommandDeck is architected as a single deployable application where a custom Node.js server acts as the central composition root.

```text
Browser / Client Layer (Next.js 16 + React 19)
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ React 19 Client UI                                                                     │
│ ┌──────────────────────┐  ┌─────────────────────────┐  ┌────────────────────────────┐ │
│ │  xterm.js Terminal   │  │   Developer Hub Panel   │  │   Cmd+K Command Palette    │ │
│ │ (Canvas + Fit Addon) │  │   (Deck & History Tabs) │  │   (Global Modal & Search)  │ │
│ └──────────┬───────────┘  └────────────┬────────────┘  └──────────────┬─────────────┘ │
│            │                           │                              │               │
│            │ Zustand (Transient UI)    │ HTTP API Requests            │               │
└────────────┼───────────────────────────┼──────────────────────────────┼───────────────┘
             │ WebSocket                 │                              │
             │ (127.0.0.1:3000/ws)       ▼                              │
Server Layer (Custom Node.js Composition Root)                          │
┌────────────┼──────────────────────────────────────────────────────────┼────────────────┐
│            ▼                                                          ▼                │
│ ┌──────────────────────┐   ┌────────────────────────┐   ┌────────────────────────────┐ │
│ │  WebSocket Gateway   │   │   Next.js API Routes   │   │   Application Services     │ │
│ │  (Terminal Manager)  │   │  (/api/history, deck)  │   │  (Capture, Deck, Settings) │ │
│ └──────────┬───────────┘   └───────────┬────────────┘   └──────────────┬─────────────┘ │
│            │                           │                               │               │
│            ▼                           ▼                               ▼               │
│ ┌──────────────────────┐   ┌─────────────────────────────────────────────────────────┐ │
│ │ node-pty (Native PTY)│   │  SQLite 3 Database (better-sqlite3 + Drizzle ORM)       │ │
│ └──────────┬───────────┘   └─────────────────────────────────────────────────────────┘ │
└────────────┼───────────────────────────────────────────────────────────────────────────┘
             ▼
      Local Operating System Shell (zsh)
```

### Stack Specification

| Component | Technology | Version | Description |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | Next.js (App Router), React | `16.2.11`, `19.2.8` | Modern server/client rendering framework |
| **Terminal Emulator** | `xterm.js` | `6.0.0` (`@xterm/addon-fit` v0.11.0) | High-performance canvas-based rendering |
| **Server Runtime** | Custom Node.js HTTP Server | `>= 22.0.0` | Composition root bound to `127.0.0.1` |
| **PTY Management** | `node-pty` | `1.2.0-beta.14` | Native OS pseudoterminal process execution |
| **Real-time Streaming**| `ws` | `8.21.1` | Low-latency bi-directional WebSocket protocol |
| **Database & Storage** | SQLite 3 (`better-sqlite3`) | `13.0.1` | Embedded local relational database |
| **ORM & Migrations** | Drizzle ORM | `0.45.2` | Type-safe SQL query builder & migrations |
| **Schema Validation** | Zod | `4.4.3` | Shared runtime schema validation |
| **Desktop Wrapper** | Electron & electron-builder | `43.2.0`, `26.15.3` | Cross-platform desktop packaging |
| **Testing Suite** | Vitest | `4.1.10` | Unit, integration, and PTY process testing |

---

## Local-First & Privacy Model

* **127.0.0.1 Loopback Isolation**: The custom Node.js server binds strictly to the loopback interface (`127.0.0.1` / `::1`). Public network binding is disallowed.
* **Zero Telemetry & External Calls**: CommandDeck sends zero diagnostic telemetry, tracking pixels, or command logs to external servers.
* **Local Data Ownership**: All durable records—workspaces, history, command definitions, deck items, settings, and launch states—reside in a local SQLite file stored in OS-designated application data directories (`~/Library/Application Support/CommandDeck` on macOS).
* **Process Permission Parity**: Spawned child processes execute under the exact operating system user permissions of the running CommandDeck process, respecting native OS file system permissions.

---

## Security Considerations

1. **Loopback Binding & Token Validation**: WebSocket upgrade endpoints require origin validation and session authentication nonces to prevent unauthorized browser tabs from interacting with the terminal backend.
2. **OSC Nonce Validation**: Injected zsh shell integration scripts append per-session cryptographically random nonces to all OSC 633 stream sequences, preventing command injection spoofing.
3. **HTML Output Sanitization**: Terminal rendering is strictly handled via xterm.js canvas buffers. Terminal text is never injected as raw HTML into the DOM, eliminating XSS risks.
4. **Explicit Command Execution**: CommandDeck never executes commands in the background silently. All executions from History, Deck, and Templates explicitly send strings to the active visible terminal window.
5. **Process Lifecycle Cleanup**: Server shutdown hooks cleanly send `SIGTERM`/`SIGKILL` to managed child PTY processes to prevent orphan background jobs.

---

## Product Differentiators

```text
┌──────────────────────────────┬──────────────────────────────┬──────────────────────────────┐
│     Traditional Terminal     │      Cloud AI Terminals      │         CommandDeck          │
├──────────────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ ❌ Volatile scrollback buffer│ ❌ Sends data to third party │ ✅ Immutable local SQLite DB │
│ ❌ Fragmented Ctrl+R history │ ❌ Requires cloud login      │ ✅ Structured status search  │
│ ❌ Manual script retyping    │ ❌ High latency & lock-in    │ ✅ Parameterized Deck        │
│ ❌ Mixed project histories   │ ❌ Unpredictable AI scripts  │ ✅ Workspace isolation       │
│ ✅ Native shell speed        │ ❌ High monthly pricing      │ ✅ 100% Free & Local-First   │
└──────────────────────────────┴──────────────────────────────┴──────────────────────────────┘
```

---

## Branding, Design Principles & Visual Aesthetics

### Design Aesthetics & Color Palette
CommandDeck features a sleek, dark developer aesthetic tailored for high legibility and reduced eye strain during long engineering sessions.

* **Background Canvas**: Deep Dark Charcoal (`#0e0e0e`)
* **Header & Panel Backgrounds**: Muted Surface (`#141414` / `#1a1a1a`)
* **Borders & Separators**: Subtle Slate (`#262626` / `#333333`)
* **Accent Colors**:
  * **Cyan** (`#06b6d4`) — Active workspace & primary terminal directory accent.
  * **Emerald Green** (`#10b981`) — Success exit status (`0`) & active connection indicators.
  * **Amber / Orange** (`#f59e0b`) — Interrupted execution status & template variables.
  * **Rose / Red** (`#ef4444`) — Failed exit status (non-zero) & destructive action warnings.

### Typography
* **Code & Terminal Text**: JetBrains Mono / Fira Code / System Monospace (`ui-monospace`, `SFMono-Regular`, `Menlo`, `Monaco`, `Consolas`).
* **UI & Headings**: Inter / System Sans-Serif (`system-ui`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`).

### Tone of Voice
* **Precise & Technical**: Speak directly to developers using accurate terminology (PTY, CWD, exit codes, variables).
* **Clean & Uncluttered**: Avoid marketing fluff. Prioritize clarity, speed, and usability.

---

## Terminology & Glossary

* **CommandDeck**: The overall application product name.
* **Workspace**: Root domain container that isolates terminal sessions, history, decks, and timeline streams per project.
* **Command History**: Immutable log of past command executions automatically recorded via OSC 633 shell integration.
* **Command Deck**: User-curated library of reusable commands and templates saved for fast execution.
* **Command Definition**: Durable record storing the exact command string or template text, decoupled from history logs.
* **History Provenance**: Tracking reference (`sourceHistoryId`) linking a Deck item back to its original history entry.
* **Template**: A reusable command string containing `{{placeholder}}` variables resolved dynamically prior to execution.
* **Activity Session**: Chronological cluster of timeline commands grouped by 15-minute inactivity intervals or working directory shifts.
* **OSC 633**: Operating System Command protocol standard used to pass structured shell markers in stdout streams.
* **PTY (Pseudoterminal)**: Software device pair providing a terminal emulation interface to shell processes.
* **Developer Hub**: Responsive right-hand side panel hosting Command Deck and Command History tabs.

---

## Frequently Asked Questions (FAQ)

### Q1: Is CommandDeck a cloud-based application?
**No.** CommandDeck is 100% local-first. The backend server runs locally on your machine (`127.0.0.1`), and all data is saved in a local SQLite database. No command history or terminal data ever leaves your computer.

### Q2: Does CommandDeck modify my shell profile (`.zshrc`) permanently?
**No.** CommandDeck injects a lightweight, nonce-authenticated shell integration script into the spawned session memory at runtime. It does not overwrite or permanently mutate your disk shell configuration files.

### Q3: How does CommandDeck capture exact exit codes and working directories?
CommandDeck uses **OSC 633 shell integration markers**. As you run commands in zsh, hidden control sequences pass structured metadata (prompt start/end, CWD, command line, exit code) directly into the streaming PTY parser.

### Q4: Can I run interactive programs like Vim, htop, or SSH inside CommandDeck?
**Yes.** CommandDeck relies on xterm.js canvas rendering and native `node-pty` processes, ensuring full compatibility with terminal control sequences, interactive TUI applications, mouse events, and alternate screen buffers.

### Q5: How do Command Templates work?
Any saved deck item can include `{{variable}}` placeholders (e.g. `docker run -p {{port}}:80 {{image}}`). Clicking the template opens a resolution modal prompting for variable inputs, shows a live command preview, and sends the expanded string to the terminal without changing the saved template definition.

---

## Platform Support & Installation

### Supported Platforms
* **macOS**: Primary reference platform (macOS 12+, Apple Silicon `arm64` and Intel `x64`). Native zsh shell integration.
* **Windows**: Electron package target (Windows 10/11 `x64`).
* **Linux**: Electron package target (Ubuntu, Fedora, Debian `x64` via AppImage).

### System Prerequisites
* **Node.js**: `>= 22.0.0`
* **npm**: `>= 11.0.0`

### Quick Start Guide (Development)
```bash
# Clone the repository
git clone https://github.com/7ochan/CommandDeck.git
cd CommandDeck

# Install dependencies
npm install

# Start the development server
npm run dev

# Open in browser at http://127.0.0.1:3000
```

### Desktop Packaging Guide (Electron)
```bash
# Build production bundle and package for current OS
npm run electron:package

# macOS DMG package build
npm run electron:package:mac

# Windows NSIS executable build
npm run electron:package:win
```

---

## Future Extensibility Implied by Architecture

*(Note: Grounded in existing database schemas, decision logs, and feature preparation code.)*

1. **Workflows Engine**: Ordered multi-step command sequences with variable bindings, step execution history, and configurable stop-on-failure rules (`workflows` and `workflow_steps` schema design ready).
2. **AI Assistance**: Multi-provider local and cloud AI setup (`gemini`, `openai`, `anthropic`, `ollama`) configured in Settings schema for terminal error diagnosis and command generation.
3. **SQLite FTS5 Full-Text Search**: Full-text indexing across command output and execution notes reserved in database architecture.
4. **Expanded Shell Integration**: Profile architecture prepared for native Bash, Fish, and Windows PowerShell (ConPTY) shell integration scripts.

---
*Document Version: 1.0.0*  
*Source Repository: [7ochan/CommandDeck](https://github.com/7ochan/CommandDeck)*  
*Generated for: Product, Design, Marketing, and Engineering Teams*
