# Vision v2 — Visual Terminal Workspace

## Core identity

> **A terminal where every command remains searchable in History and useful commands become a curated Command Deck.**

Everything else exists to support this idea.

## Product principles

1. **History records; the Deck reuses.** The terminal automatically preserves execution facts in Command History, while users deliberately curate editable commands into the Command Deck.
2. **Terminal reliability comes first.** Visual features must not weaken normal shell behavior, resize handling, interactive programs, or process lifecycle management.
3. **Local-first by default.** Terminal processes and command history remain on the user's machine.
4. **The user remains in control.** Re-running commands and triggering quick actions must be deliberate and visible.
5. **Build depth before breadth.** The core terminal-to-History-to-Deck experience must be complete before plugins, collaboration, remote access, or desktop packaging are considered.

## MVP

### 1. Browser terminal foundation

- Fully functional terminal in the browser
- Connects to the user's local shell through the local Node.js server
- Multiple terminal tabs
- Reliable resize and process lifecycle handling

Nothing decorative should take priority over terminal reliability.

### 2. Command History and Command Deck

Every detected command becomes an immutable History entry containing:

- Command text
- Output
- Exit status
- Execution duration
- Timestamp
- Working directory or project context

History actions:

- Copy
- Re-run
- Add to Command Deck

The Command Deck contains only commands explicitly chosen by the user. Deck items have an editable display name, command, and optional description, retain provenance to their source History entry, persist locally, and execute visibly through the active terminal. A Deck command may contain `{{variable}}` placeholders; CommandDeck requests each distinct value, previews the expanded command, and substitutes it only for that execution.

This History-to-Deck flow is the product's defining feature.

### 3. Quick-action sidebar

A customizable sidebar provides deliberate, reusable terminal actions such as:

- Git status, pull, push, and commit
- Dependency installation
- Development server commands
- Docker Compose start and stop

Users can add, edit, reorder, group, and assign icons to actions. Actions must clearly distinguish between inserting a command and immediately executing it.

### 4. Searchable timeline

Command History can:

- Search commands, output, and notes
- Filter by workspace or project
- Filter by date and execution status
- Filter by tags, pins, and bookmarks
- Restore the context of a previous command quickly

### 5. Reusable workflows

Users can turn repeated command sequences into simple ordered workflows. Initial workflows should remain understandable: ordered steps, optional variables, and explicit stop-on-failure behavior.

## Current delivery model

The first complete version is a locally served web application:

- Next.js and TypeScript provide the browser interface.
- A long-running local Node.js process owns terminal processes and server-side services.
- xterm.js renders terminal sessions.
- node-pty connects Node.js to the local shell.
- WebSockets carry live terminal traffic.
- SQLite stores durable application data and searchable command history.
- Zustand manages transient client-side workspace state.

The server binds to the loopback interface and is intended for use only on the same machine. It is not a hosted terminal service.

Electron is postponed until the web product is stable and feature-complete. AI functionality is outside the MVP and current roadmap and may only be reconsidered after the core product is complete.

## Future possibilities

- Workspace snapshots
- Project notes
- Workspace modes
- Plugins
- Collaboration
- Remote terminals
- Desktop packaging

These are not allowed to delay or complicate the core History-and-Deck product.

## Success criteria

The core product is successful when a user can:

1. Open reliable local terminal sessions in the browser.
2. See normal commands captured accurately as durable History entries.
3. Find a past command or error faster than by searching raw scrollback.
4. Curate and reuse commands safely through the Command Deck and simple workflows.
5. Restart CommandDeck without losing saved command history or organization.

## Product pitch

A local browser-based terminal workspace where every command stays searchable in History and useful commands become an editable, persistent Command Deck.
