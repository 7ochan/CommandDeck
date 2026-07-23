# Vision v2 — Visual Terminal Workspace

## Core identity

> **A terminal where every command becomes a reusable visual object instead of disappearing into scrollback.**

Everything else exists to support this idea.

## Product principles

1. **Command cards are the product.** The terminal, timeline, actions, and workflows exist to make executed commands easier to understand, find, and reuse.
2. **Terminal reliability comes first.** Visual features must not weaken normal shell behavior, resize handling, interactive programs, or process lifecycle management.
3. **Local-first by default.** Terminal processes and command history remain on the user's machine.
4. **The user remains in control.** Re-running commands and triggering quick actions must be deliberate and visible.
5. **Build depth before breadth.** The core terminal-to-card experience must be complete before plugins, collaboration, remote access, or desktop packaging are considered.

## MVP

### 1. Browser terminal foundation

- Fully functional terminal in the browser
- Connects to the user's local shell through the local Node.js server
- Multiple terminal tabs
- Reliable resize and process lifecycle handling

Nothing decorative should take priority over terminal reliability.

### 2. Visual command cards

Every detected command becomes a card containing:

- Command text
- Output
- Exit status
- Execution duration
- Timestamp
- Working directory or project context

Card actions:

- Pin
- Bookmark
- Copy
- Re-run
- Add a note
- Add tags
- Convert to a workflow

This is the product's defining feature.

### 3. Quick-action sidebar

A customizable sidebar provides deliberate, reusable terminal actions such as:

- Git status, pull, push, and commit
- Dependency installation
- Development server commands
- Docker Compose start and stop

Users can add, edit, reorder, group, and assign icons to actions. Actions must clearly distinguish between inserting a command and immediately executing it.

### 4. Searchable timeline

Command history becomes a structured timeline that can:

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

These are not allowed to delay or complicate the core command-card product.

## Success criteria

The core product is successful when a user can:

1. Open reliable local terminal sessions in the browser.
2. See normal commands captured accurately as durable cards.
3. Find a past command or error faster than by searching raw scrollback.
4. Reuse commands safely through cards, quick actions, and simple workflows.
5. Restart CommandDeck without losing saved command history or organization.

## Product pitch

A local browser-based terminal workspace where commands become searchable, reusable workflow objects instead of disappearing forever.
