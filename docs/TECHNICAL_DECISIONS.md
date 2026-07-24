# Technical Decision Log

This file records the decisions that constrain the initial CommandDeck implementation. A decision should be amended here before implementation deliberately diverges from it.

## TD-001 — Local web application

**Status:** Accepted

**Decision:** CommandDeck initially runs as a local web application on the same machine as the user's shell. The Node.js server binds to the loopback interface by default.

**Reason:** Browsers cannot create local PTYs. Keeping the server local provides shell access without designing a remote multi-user execution service.

**Consequences:** Serverless hosting and public deployment are unsupported. Remote access requires a separate future security architecture.

## TD-002 — Next.js with a custom Node.js server

**Status:** Accepted

**Decision:** Use Next.js App Router for the web application and a small custom Node.js server as the runtime composition root. The server attaches WebSockets to the HTTP server used by Next.js.

**Reason:** PTYs and WebSocket sessions are long-lived, stateful resources. A custom server keeps them in one clear process while Next.js continues to own pages and HTTP route handlers.

**Consequences:** The project does not target serverless platforms or Next.js standalone output. The custom server must have its own production build and shutdown handling. Next.js documents that custom servers trade some framework optimizations for capabilities not covered by the integrated server; this is acceptable for a local application.

**Reference:** [Next.js custom server guide](https://nextjs.org/docs/app/guides/custom-server)

## TD-003 — WebSocket for live traffic, HTTP for durable resources

**Status:** Accepted

**Decision:** Use the browser's native WebSocket client and the `ws` library on the Node.js server for a versioned terminal protocol. Use Next.js route handlers for CRUD, search, and other request-response operations. Validate boundary payloads with Zod.

**Reason:** Terminal output requires ordered, bidirectional, low-latency communication. Durable resources benefit from conventional HTTP semantics and are easier to test and inspect there.

**Consequences:** Shared Zod schemas are required for both boundaries. The client must reconcile live events with server-authoritative durable records. The WebSocket server must claim only its dedicated upgrade path so it does not interfere with Next.js development traffic.

## TD-004 — node-pty is server-only

**Status:** Accepted

**Decision:** Only the local Node.js terminal service may import and operate node-pty. Each terminal tab maps to one managed PTY session.

**Reason:** node-pty requires native operating-system access and inherits the permissions of the parent process.

**Consequences:** Native dependency builds must be verified on every supported platform. PTY objects cannot be serialized, stored in Zustand, or accessed from Next.js client components.

**Reference:** [node-pty documentation and security note](https://github.com/microsoft/node-pty)

## TD-005 — Shell integration, not output heuristics

**Status:** Accepted

**Decision:** Detect commands through injected, nonce-aware shell integration and structured OSC markers. Parse them with a streaming state machine.

**Reason:** Keyboard and prompt heuristics cannot reliably identify exact commands, output boundaries, working directories, or exit codes.

**Consequences:** Integration scripts must be maintained per supported shell. Unsupported shells retain terminal functionality but may not produce command cards.

**Reference:** [VS Code terminal shell-integration protocol](https://code.visualstudio.com/docs/terminal/shell-integration)

## TD-006 — SQLite is the single durable store

**Status:** Accepted

**Decision:** Store workspaces, command runs, organization, quick actions, workflows, and settings in one local SQLite database. Use `better-sqlite3` as the Node.js driver and Drizzle for typed access and migrations. Use FTS5 for textual search, foreign keys for integrity, WAL mode for normal operation, and explicit SQL migrations where SQLite-specific features require them.

**Reason:** The product is single-user and local-first. SQLite provides transactions and full-text search without operating another service.

**Consequences:** Large terminal output must be bounded. Migrations, backup, recovery, and test-database isolation are part of the product, not optional infrastructure work.

**Reference:** [SQLite FTS5 documentation](https://www.sqlite.org/fts5.html)

## TD-007 — Zustand stores transient client state

**Status:** Accepted

**Decision:** Use Zustand for active tabs, connection state, UI layout, selections, filters, and bounded optimistic state. Do not make it the durable domain store or route raw PTY output through it.

**Reason:** High-frequency terminal bytes and durable records have different lifecycles from UI state.

**Consequences:** Durable changes must be confirmed by HTTP responses or server events. xterm.js buffers remain owned by terminal components.

## TD-008 — Server-authoritative terminal lifecycle

**Status:** Accepted

**Decision:** The Node.js terminal manager owns session creation, process state, dimensions, exit, disconnect, and cleanup. Browser tab state is a projection of server state.

**Reason:** A browser can reload, disconnect, or crash while shell processes remain alive. Only the server can reliably manage the child-process lifecycle.

**Consequences:** The WebSocket protocol needs explicit session IDs and reconnection semantics. Shutdown and abandoned-session behavior require integration tests.

## TD-009 — Feature-oriented repository structure

**Status:** Accepted

**Decision:** Organize browser code by product feature, privileged code under `src/server`, and serializable contracts under `src/shared`.

**Reason:** This makes runtime boundaries visible and prevents terminal infrastructure from leaking into UI code.

**Consequences:** Generic folders should remain small. Cross-feature behavior moves into application services or explicit shared contracts rather than informal utility modules.

## TD-010 — Simple ordered workflows

**Status:** Accepted

**Decision:** Initial workflows consist of ordered command steps, explicit variables, and stop-on-failure behavior. They run visibly through a managed terminal and produce normal command cards.

**Reason:** This delivers command reuse without turning the project into a scheduler or general automation engine.

**Consequences:** Parallel DAGs, background jobs, cron scheduling, and arbitrary executable plugins are deferred.

## TD-011 — macOS and zsh are the reference platform

**Status:** Accepted

**Decision:** Complete the first reliable vertical slice on macOS with zsh. Add bash, fish, and Windows PowerShell through an explicit compatibility phase.

**Reason:** Shell integration and PTY behavior vary by platform. Supporting all environments before the capture model is proven would multiply debugging variables.

**Consequences:** Platform-specific behavior must stay behind shell-profile and PTY adapter boundaries. Reference-platform shortcuts must not leak into shared domain contracts.

## TD-012 — Electron is postponed

**Status:** Accepted

**Decision:** Do not use, initialize, configure, or design UI APIs around Electron during initial development. Reconsider a wrapper only after the web product is stable and feature-complete.

**Reason:** The browser application and core terminal model must be validated before adding desktop packaging and runtime concerns.

**Consequences:** The initial runtime is started as a local Node.js web application. Electron-specific IPC, preload bridges, packaging, and update mechanisms do not belong in the current source tree.

## TD-013 — AI is outside the current roadmap

**Status:** Accepted

**Decision:** Do not add AI providers, prompts, chat interfaces, embeddings, vector stores, AI abstractions, or AI-specific data models to the initial architecture or roadmap.

**Reason:** The product must succeed through reliable command capture, search, reuse, and workflows without depending on AI.

**Consequences:** AI may be reconsidered only after the core product is complete, through a new decision and roadmap. No speculative extension points are required now.

## TD-014 — Stored commands execute visibly and deliberately

**Status:** Accepted

**Decision:** Quick actions declare whether they insert or execute a command. Workflows preview resolved variables and execute through visible managed terminal sessions. The explicit Command Card Run Again action executes the exact stored command through the active managed terminal session.

**Reason:** Stored command execution has the same permissions and risk as manual terminal input.

**Consequences:** There is no hidden background execution. The UI and protocol must preserve a clear distinction between editing, inserting, and executing commands. Re-run remains an explicit labeled action and never bypasses the terminal session architecture.

## TD-015 — Test at protocol and process boundaries

**Status:** Accepted

**Decision:** Use Vitest for unit and integration tests, React Testing Library for component behavior, and Playwright for end-to-end browser flows. Maintain a separate PTY integration suite against real supported shells.

**Reason:** The highest-risk failures occur between stream chunks, WebSocket events, real shell processes, persistence, and browser lifecycle rather than inside isolated UI components.

**Consequences:** Tests require deterministic shell fixtures, temporary SQLite databases, process cleanup checks, and selective serialization of native PTY suites.

## TD-016 — Incremental command-card search

**Status:** Accepted

**Decision:** Introduce the first search slice as repository-backed, case-insensitive literal substring matching over command text and working directory, combined with structured derived-status filters. A command completed by the shell with exit code 0 is successful; exit code 130 or session-exit completion is interrupted; every other shell completion is failed. Keep these query semantics in shared domain helpers and HTTP contracts. Continue to reserve FTS5 for the broader command-output-note search planned in Phase 3.

**Reason:** The current command-card table contains only command and working-directory search fields. Literal substring search matches the live-search interaction developers expect, treats shell metacharacters as ordinary text, and avoids introducing an FTS migration that would be replaced when output and notes become durable fields.

**Consequences:** Filtering occurs in SQLite rather than over the loaded React list. The UI debounces and cancels superseded HTTP requests, while completed-command events may be merged optimistically when they match the active query. Search is not yet ranked, tokenized, or extended to output and notes.

## Open implementation parameters

These details should be resolved by Phase 0 measurements without changing the architecture:

- Initial output batch size and flush interval
- Per-command persistence limit
- Reconnect grace period
- Styling system and accessible component primitives

Selections should favor maintained, small dependencies and be recorded here when accepted.
