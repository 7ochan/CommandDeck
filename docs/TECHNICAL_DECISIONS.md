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

**Consequences:** Integration scripts must be maintained per supported shell. Unsupported shells retain terminal functionality but may not produce Command History entries.

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

**Decision:** Initial workflows consist of ordered command steps, explicit variables, and stop-on-failure behavior. They run visibly through a managed terminal and produce normal Command History entries.

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

**Decision:** Quick actions declare whether they insert or execute a command. Workflows preview resolved variables and execute through visible managed terminal sessions. Explicit Run Again actions from History and Run actions from the Command Deck execute their stored command through the active managed terminal session.

**Reason:** Stored command execution has the same permissions and risk as manual terminal input.

**Consequences:** There is no hidden background execution. The UI and protocol must preserve a clear distinction between editing, inserting, and executing commands. History and Deck execution remain explicit and never bypass the terminal session architecture; successful execution is captured back into History through the ordinary shell-integration path.

## TD-015 — Test at protocol and process boundaries

**Status:** Accepted

**Decision:** Use Vitest for unit and integration tests, React Testing Library for component behavior, and Playwright for end-to-end browser flows. Maintain a separate PTY integration suite against real supported shells.

**Reason:** The highest-risk failures occur between stream chunks, WebSocket events, real shell processes, persistence, and browser lifecycle rather than inside isolated UI components.

**Consequences:** Tests require deterministic shell fixtures, temporary SQLite databases, process cleanup checks, and selective serialization of native PTY suites.

## TD-016 — Incremental Command History search

**Status:** Accepted

**Decision:** Introduce the first Command History search slice as repository-backed, case-insensitive literal substring matching over command text and working directory, combined with structured derived-status filters. A command completed by the shell with exit code 0 is successful; exit code 130 or session-exit completion is interrupted; every other shell completion is failed. Keep these query semantics in shared domain helpers and HTTP contracts. Continue to reserve FTS5 for the broader command-output-note search planned in Phase 3.

**Reason:** The current History table contains only command and working-directory search fields. Literal substring search matches the live-search interaction developers expect, treats shell metacharacters as ordinary text, and avoids introducing an FTS migration that would be replaced when output and notes become durable fields.

**Consequences:** Filtering occurs in SQLite rather than over the loaded React list. The UI debounces and cancels superseded HTTP requests, while completed-command events may be merged optimistically when they match the active query. Search is not yet ranked, tokenized, or extended to output and notes.

## TD-017 — Immutable History and curated Command Deck

**Status:** Accepted

**Decision:** Separate automatically captured Command History from the user-curated Command Deck. History entries are immutable execution facts owned by the capture service. A Deck item stores presentation metadata and references a reusable command definition; that definition stores the editable command snapshot and optionally references the History entry from which it originated. History and Deck use separate repositories, application services, HTTP contracts, and browser features. Deck execution sends the stored definition through the existing visible terminal execution pipeline.

**Reason:** Automatic execution records and user-maintained shortcuts have different lifecycles. Keeping the source History foreign key preserves provenance without copying execution metadata, while a separate definition is necessary because editing Deck command text must never alter the original History record. Reusable definitions also allow future workflows or other deliberate execution surfaces to reference the same command without changing History storage.

**Consequences:** Adding a History entry to the Deck copies only its command text into a definition and creates one Deck item linked to both records in a transaction. Removing that item removes its now-unreferenced definition. Display name, description, and command edits affect only Deck-owned tables. Future tags, categories, favorites, and richer variable metadata require their own decisions and migrations; they are not implied by this separation.

## TD-018 — Plain Command Template substitution

**Status:** Accepted

**Decision:** Support Command Deck templates using exact, case-sensitive `{{name}}` tokens, with names limited initially to `[A-Za-z_][A-Za-z0-9_]*`. A shared browser-and-server-safe module owns parsing, ordered deduplication, occurrence spans, friendly labels, input validation, preview generation, and final expansion. Expansion replaces exact parsed occurrence spans with user-provided strings and performs no evaluation. Persist only the original template in `command_definitions`; values and expanded commands exist only for the immediate execution.

**Reason:** Template syntax is domain behavior needed consistently by editor validation, execution UI, server boundaries, tests, and future approved reuse surfaces. A small explicit grammar prevents UI-specific parsing differences and avoids introducing an expression language or hidden shell behavior.

**Consequences:** Malformed brace syntax, blank values, nested placeholders, and unresolved placeholders block saving or execution. Duplicate placeholders prompt once and reuse the same value, ordered by first appearance. Commands without placeholders retain immediate execution. Defaults, optional variables, environment lookup, and persisted values require a future versioned grammar decision and are not inferred by the initial parser.

## TD-019 — Workspace-rooted data and terminal assignment

**Status:** Accepted

**Decision:** Make Workspace the required root context for Command History, command definitions, Command Deck items, and terminal sessions. Create `Default Workspace` during migration and assign every existing row to it. Keep active Workspace in the browser root, supply it at the authenticated WebSocket connection boundary for terminal creation, and use a versioned WebSocket message for subsequent session switches. A switch terminates the current PTY and creates a new terminal session for the target Workspace; it never reassigns the existing shell. Snapshot the owning Workspace ID when a command starts. Require an explicit Workspace ID for every History and Deck service/repository operation; do not introduce a process-global active Workspace.

**Reason:** UI-only filtering cannot guarantee that asynchronous shell completions are stored in the correct context. Per-terminal assignment provides a durable event boundary, isolates concurrent or future terminals naturally, and keeps History and Deck services independent from workspace-selection state.

**Consequences:** Workspace switches abort and replace active History/Deck loads, reset feature-local filters and template dialogs, terminate the old PTY, reset the browser terminal buffer, and bind the existing authenticated socket to a new server session ID. A command interrupted by switching remains attributed to the Workspace in which it started. Workspace deletion cascades owned data, is forbidden for the final remaining Workspace, and requires successfully starting a terminal for a remaining Workspace before deleting the active one. Workspace IDs lead History and Deck indexes and are validated at HTTP and WebSocket boundaries.

## TD-020 — Timeline is a derived History projection

**Status:** Accepted

**Decision:** Implement the Workspace Timeline as a browser-side projection of the existing workspace-scoped Command History query. Do not store Timeline events or Activity Sessions. Group visible entries chronologically using a fixed 15-minute inactivity boundary and a pure normalized working-directory context heuristic. Keep grouping outside React, memoize it at the view boundary, and render event rows only for expanded sessions. Reuse the existing History search/status query, Deck mutation, clipboard, and visible terminal execution paths.

**Reason:** Timeline and History describe the same immutable executions but answer different questions. A second durable activity model would duplicate facts and create synchronization failures. Pure grouping is deterministic, independently testable, and can later consume explicit project-root metadata without migrating Timeline records.

**Consequences:** Filtering may change the visible Activity Session projection because sessions are derived from the filtered History result. Timeline selection, collapse state, and one-time terminal handoff are transient. Run Again navigates to the terminal view and waits for the matching Workspace assignment before sending the command. Expanded sessions reveal events in batches of 100; the event boundary remains suitable for future viewport virtualization but is not yet virtualized. Analytics, charts, and persisted session annotations remain out of scope.

## TD-021 — Workspace Terminal State is durable launch configuration

**Status:** Accepted

**Decision:** Persist lightweight terminal state in a dedicated, Workspace-owned SQLite record. The initial record contains the last cwd reported by trusted shell integration and its update timestamp. Terminal creation receives the browser's active Workspace ID at the WebSocket upgrade boundary, validates that Workspace, loads its terminal state through a dedicated service, validates the saved directory immediately before PTY creation, and falls back to the user's home directory when the saved cwd is absent or invalid. Persist a cwd marker only when it differs from the Workspace's stored cwd.

**Reason:** Browser refresh creates a new shell and must recover only durable launch context, not process or terminal-emulator state. Keeping this state outside History and Deck preserves their domain boundaries, while a launch-configuration object and patch-style state update allow future terminal preferences to be added without changing the terminal manager's persistence API.

**Consequences:** Each Workspace restores its own last reported directory for initial and replacement terminal sessions. Workspace switching terminates the current PTY and creates a new one from the selected Workspace's saved state. Missing directories never reach node-pty as a cwd. PTYs, output, scrollback, and running processes are not persisted or restored.

## TD-022 — Terminal modernization preserves native rendering

**Status:** Accepted

**Decision:** Keep xterm.js as the only terminal renderer and keep all terminal input, output, resize, and execution traffic unchanged. Isolate browser typography, theme, cursor, and contrast options in a terminal presentation module. For the reference zsh integration, install a CommandDeck-owned two-line prompt that displays only abbreviated cwd and `❯`, clears the right prompt, and uses the existing prompt markers. Emit a single newline after an integrated command completion to create subtle visual separation before the next prompt.

**Reason:** A modern terminal can be easier to scan without creating a second rendering model. Prompt rendering belongs to the shell, xterm appearance belongs to browser presentation, and command lifecycle remains owned by the existing structured shell protocol.

**Consequences:** User zsh startup files and shell behavior still load normally, but their visible primary and right prompts are replaced inside CommandDeck. Unsupported shells retain their native prompts. At this baseline stage, command separation is not a React card, decoration, persisted record, or output rewrite. TD-023 extends the presentation with xterm-owned marker decorations while retaining the other constraints. Rich command blocks, custom renderers, and terminal-output restoration remain outside this phase.

## TD-023 — Command sections use xterm-anchored completion separators

**Status:** Accepted

**Decision:** Keep the shell-emitted completion newline from TD-022 and add a browser-only command-section presentation coordinator. The coordinator consumes the existing ordered `command.started` and `command.completed` events, waits for earlier terminal writes to be parsed, and registers one text-free xterm marker decoration at each completed command boundary. The active command is never decorated as complete. Decorations are presentation-only, pointer-inert, hidden from assistive technology, and disposed on scrollback trimming, terminal reset, or session replacement. No output bytes, ANSI sequences, History records, or React command blocks are created or changed.

**Reason:** A marker-backed separator makes completed commands easier to scan without inserting visible rule characters into terminal output or maintaining a second terminal model. xterm owns marker movement, viewport placement, alternate-buffer suppression, and scrollback disposal, so presentation work scales with retained completed commands rather than output volume.

**Consequences:** CommandDeck opts into xterm's proposed decoration API behind an isolated presentation module while continuing to use stable PTY, parser, input, resize, and buffer APIs everywhere else. If decoration registration is unavailable, the native completion spacing remains intact. The retained marker boundary is suitable for future lightweight section presentation, but this decision does not add metadata, actions, cards, or durable command-section state.

## TD-024 — Developer Hub is the terminal-route extension boundary

**Status:** Accepted

**Decision:** Replace the stacked terminal sidebar with a compact, typed Developer Hub tab registry in the layout layer. Register only Deck and History initially, reuse their existing feature components and root-owned hooks, and keep both tab panels mounted while making the inactive panel hidden and inert. Place the Hub to the right of a flexible terminal on desktop and collapse the same mounted Hub beneath the terminal on smaller screens. Present Workspace selection and terminal connection state in a compact context bar, with create, rename, and delete remaining in the existing management dialog opened from an overflow control.

**Reason:** The terminal should dominate the workspace without making History or Deck slower to reach or creating duplicate feature state. A stable tab composition provides one long-term UI extension point, while mounted panels preserve local interaction, keyboard, dialog, and scroll state across instant tab switches.

**Consequences:** Developer Hub state is transient presentation state and introduces no protocol, database, API, or durable model changes. History and Deck lifecycle, search, selection, template execution, and mutations remain owned by their current features. Future approved modules can add a tab and panel at this boundary, but Workflows, AI, and Analytics are not implemented or registered in this phase; TD-013 continues to govern AI. Responsive collapse changes only visibility and sizing, never terminal or feature ownership.

## Open implementation parameters

These details should be resolved by Phase 0 measurements without changing the architecture:

- Initial output batch size and flush interval
- Per-command persistence limit
- Reconnect grace period
- Styling system and accessible component primitives

Selections should favor maintained, small dependencies and be recorded here when accepted.
