# CommandDeck Architecture

## Status

Accepted architecture for the initial web application. This document describes the target system before implementation begins.

## Architectural goals

- Preserve normal terminal behavior while adding structured command history.
- Keep terminal access and stored data on the local machine.
- Keep immutable Command History and curated Command Deck items as distinct durable domain objects.
- Make Workspace the explicit root context for terminals, History, Deck, and future workflows.
- Use one understandable application runtime rather than distributed services.
- Keep live terminal traffic separate from durable data operations.
- Establish boundaries that can be tested independently.

## System boundary

CommandDeck is a **local web application**, not a remotely hosted terminal service.

The user starts one Node.js application on their machine and opens its loopback URL in a browser. The same local application serves the Next.js interface, manages PTY processes, and stores data in SQLite. The server must bind to `127.0.0.1` or `::1` by default and must never be exposed publicly without a separate security design.

A normal browser cannot access the operating system shell directly. All shell access therefore remains inside the local Node.js runtime through node-pty.

## Runtime overview

```text
Browser
┌────────────────────────────────────────────────────────────┐
│ Next.js / React UI                                         │
│                                                            │
│  xterm.js terminals  command history  command deck        │
│          │                    │                    │         │
│          └──── Zustand: transient client state ───┘         │
└───────────────┬────────────────────────┬───────────────────┘
                │ WebSocket              │ HTTP API
                │ live ordered events    │ durable queries
                ▼                        ▼
Local Node.js process bound to loopback
┌────────────────────────────────────────────────────────────┐
│ Custom server + Next.js request handler                    │
│                                                            │
│  WebSocket gateway   application services   API handlers   │
│          │                    │                    │         │
│          ▼                    ▼                    ▼         │
│  terminal manager    command capture       repositories    │
│          │                    │                    │         │
│          └────── shell integration parser ────────┘         │
│          │                              │                   │
│       node-pty                       SQLite + FTS5           │
└──────────┬─────────────────────────────────────────────────┘
           ▼
   Local shell processes
```

## Runtime composition

The application uses a small custom Node.js server as its composition root. It:

1. Creates the HTTP server on the loopback interface.
2. Starts the Next.js request handler for pages and HTTP route handlers.
3. Attaches the terminal WebSocket gateway to the same HTTP server.
4. Initializes the database, repositories, and terminal session manager once.
5. Handles graceful shutdown of PTYs, WebSocket connections, and SQLite.

This is one deployable application and one operating-system process, not a frontend service plus a separately deployed backend. A custom server is justified because PTY sessions and WebSockets require long-lived process state that ordinary request handlers should not own.

The WebSocket server handles only a dedicated terminal path such as `/ws/terminal`; all other HTTP requests and upgrade paths remain owned by Next.js. A process-scoped server container makes the same application services available to HTTP route handlers and the WebSocket gateway without creating duplicate terminal managers.

The accepted trade-off is that CommandDeck will not target serverless platforms or Next.js standalone-output deployment. Those targets are incompatible with the local-shell product boundary.

## Frontend architecture

### Next.js application

- Use the App Router and TypeScript.
- Keep xterm.js and browser-only APIs behind client-component boundaries.
- Use server-rendered components only where they simplify initial loading; the active terminal workspace is inherently client-driven.
- Organize code by product feature rather than by generic file type.

### xterm.js

Each terminal tab owns one xterm.js instance in the browser and corresponds to one server-side PTY session. The frontend:

- Sends keyboard input and resize events.
- Receives ordered PTY output.
- Renders the live terminal independently of History and Deck views.
- Disposes terminal instances and event listeners when tabs close.

The application does not implement its own terminal emulator.

### Terminal presentation

Terminal presentation remains layered over the existing xterm.js and shell-integration boundaries. A browser-only terminal presentation module owns xterm typography, cursor, contrast, and color options; React owns the lightweight Workspace context header and responsive frame styling. Neither layer parses terminal output or changes input, resize, copy/paste, or command execution behavior.

On the reference zsh profile, a dedicated prompt-presentation script replaces the user's visible primary prompt inside CommandDeck with a compact two-line prompt containing only the abbreviated current directory and a `❯` command indicator. The existing OSC prompt markers still surround the prompt and remain the command-capture boundary. After a detected command completes, the shell integration emits one presentation-only newline before the next prompt. This spacing is ordinary terminal output: xterm.js remains the renderer, interactive applications keep direct PTY behavior, and no React command blocks or custom output model are introduced.

### Zustand

Zustand stores transient browser state only, including:

- Open tab metadata and active tab ID
- WebSocket connection state
- Current layout and sidebar state
- History filters and selected History or Deck entries
- Optimistic state awaiting server confirmation

SQLite remains the source of truth for durable entities. Persisting domain records directly in browser storage is not permitted.

## Backend architecture

### Terminal session manager

The terminal manager owns a registry of active sessions. Each session contains:

- A generated session ID
- The node-pty process
- Shell profile and working directory
- Current dimensions
- Shell-integration parser state
- Command-capture state
- Owning WebSocket connection or reconnect token
- Current Workspace ID used for subsequent command starts

It is responsible for create, input, resize, close, exit, disconnect, and shutdown behavior. PTY objects must never cross the server boundary.

Workspace selection is a terminal-session lifecycle boundary, not a process-global singleton or a mutable label on a running shell. The browser supplies the initial Workspace at the authenticated WebSocket connection boundary and sends a validated workspace-selection message on every subsequent switch. The gateway detaches the current session, terminates its PTY, creates a new session from the selected Workspace's launch configuration, and sends a new `terminal.started` event with a new session ID over the existing authenticated socket. The browser resets its xterm.js instance before binding to the replacement session.

The terminal session snapshots its Workspace ID into `command.started`. If a Workspace switch terminates a running command, session-exit completion retains that snapshot and is persisted to the old Workspace before the replacement session begins. This prevents shell state and late command completion from leaking into the newly active Workspace.

New terminal connections include the browser's active Workspace ID in the authenticated WebSocket upgrade URL. Before creating a PTY, the gateway validates the Workspace and the terminal manager requests a launch configuration from the Workspace Terminal State service. The service loads that Workspace's saved cwd; the PTY adapter accepts it only when it is an existing directory and otherwise uses the user's home directory. This validation occurs before every spawn.

### Workspace Terminal State

Workspace Terminal State is a dedicated server component with its own repository and service. Its durable record is keyed by Workspace and initially contains the last cwd reported by shell integration plus an update timestamp. Repeated markers for the same cwd do not update the row or timestamp. The state and launch-configuration APIs use objects so later terminal preferences such as dimensions, environment selection, or shell profile can be added without coupling them to History, Deck, or Timeline.

Shell cwd markers update the state of the Workspace that owns that terminal session. Switching Workspaces never reassigns a running shell: it terminates the old session and creates a new one from the selected Workspace's independently persisted state.

### Shell process

Initial support targets macOS with zsh. Bash, fish, and PowerShell are added only after the zsh path is reliable.

Shell environment handling must preserve the user's expected PATH, startup files, locale, terminal type, and working directory. Every spawned process has the same permissions as the CommandDeck server, so the server cannot be treated as an untrusted or multi-user service.

### Command detection

Command boundaries must not be inferred from Enter key presses, prompt regular expressions, or output formatting. Those methods fail for multiline input, paste, shell plugins, aliases, and nested programs.

CommandDeck will inject a shell-integration script that emits structured OSC markers for:

- Prompt start and end
- The exact command line
- Command execution start
- Command completion and exit code
- Current working directory

The parser is a streaming state machine because control sequences can be split across PTY output chunks. A per-session nonce should be validated where the shell protocol supports it. Marker data is removed from persisted command output while ordinary PTY output continues to xterm.js.

The capture lifecycle is:

```text
prompt ready
    → command accepted
    → command running
    → output accumulated
    → completion marker received
    → Command History entry finalized and persisted
```

If the PTY exits while a command is running, the command is finalized as `interrupted`. If rich shell integration is unavailable, the terminal must continue working while History capture is marked unavailable rather than guessing incorrect boundaries.

### Interactive applications

Programs such as Vim, `top`, REPLs, SSH sessions, and alternate-screen TUIs do not map cleanly to normal command output. The initial product will:

- Preserve their live xterm.js behavior.
- Create an interactive History entry with command and lifecycle metadata where detection is possible.
- Avoid promising a replayable or visually exact transcript.

Interactive-program support must never damage the underlying terminal session.

## Communication model

### WebSocket

WebSocket is used only for ordered, low-latency session traffic and related live events.

Client-to-server event families:

- `terminal.create`
- `terminal.input`
- `terminal.execute`
- `terminal.resize`
- `terminal.close`
- `terminal.reconnect`
- `terminal.workspace.select`

Server-to-client event families:

- `terminal.started`
- `terminal.output`
- `terminal.exited`
- `terminal.error`
- `terminal.workspace.selected`
- `command.started`
- `command.completed`

All messages use a versioned envelope, session ID, event type, and Zod-validated payload. The browser uses its native WebSocket client and the Node.js server uses `ws`. Output should be batched under load without changing byte order. Protocol schemas and TypeScript types live in the shared contracts layer.

### HTTP API

Next.js route handlers provide request-response operations for durable data:

- Workspaces
- Historical command runs
- Notes, tags, pins, and bookmarks
- Quick-action groups and actions
- Workflows and workflow runs
- Settings
- Search and filters

The HTTP API and WebSocket gateway call the same application services and repositories. UI components do not access SQLite or server modules directly.

The initial Command History query performs literal case-insensitive command and working-directory matching in the SQLite repository and combines it with structured status predicates. The HTTP query contract is intentionally extensible so later workspace and date filters can be added without moving filtering into presentation components. FTS5 remains the target for broader command-output-note search once those durable fields are available.

Command Deck CRUD uses a separate HTTP resource and application service. Adding from History is a server-side transaction that validates the source entry, creates an editable command definition, and creates a Deck item with source provenance. Deck execution itself is client-initiated through the active terminal's existing `terminal.execute` message; shell integration then creates an ordinary new History entry. The Deck service never writes History execution rows, and the History capture service never creates or edits Deck data.

Workspace CRUD uses its own repository and service. Every History and Deck service method receives a Workspace ID explicitly; neither service reads an ambient active Workspace. HTTP routes require Workspace IDs and repositories include Workspace predicates in every query or mutation. The browser root owns the active selection, while each terminal session owns the server-authoritative assignment used by capture. Deleting the last Workspace is rejected.

Command Templates are a shared, runtime-neutral domain module rather than React behavior. The initial grammar recognizes exact `{{name}}` tokens whose case-sensitive names match `[A-Za-z_][A-Za-z0-9_]*`. Parsing returns ordered unique placeholders, every occurrence span, and structured syntax errors. Validation rejects malformed templates, missing or whitespace-only values, and expanded commands that still contain placeholder syntax. Expansion performs only position-based plain string substitution: it does not evaluate expressions, shell syntax, nesting, defaults, environment variables, or template logic.

Deck definitions continue to persist the exact template text. Placeholder values and expanded commands are transient UI state and are never written back to the definition. Commands without placeholders execute immediately. Commands with placeholders open a client dialog that deduplicates names by first appearance, shows a live read-only preview, and sends the validated expanded command through the same `terminal.execute` path. This keeps template parsing reusable by future approved consumers without coupling it to Deck presentation or implementing AI.

### Workspace Timeline

The dedicated `/timeline` route consumes the same active-Workspace History query as the sidebar. It does not introduce a Timeline API, table, repository, or durable session record. A runtime-neutral grouping module sorts visible History chronologically and starts a new Activity Session when the gap between the previous completion and next start exceeds 15 minutes or the normalized working-directory context changes. The initial directory-context heuristic keeps commands under the same home-directory project root together; explicit persisted project roots can replace that heuristic later without changing History.

Search and status filters stay repository-backed and are shared with the History UI. Grouping is memoized over the returned immutable entries. Sessions render as collapsible boundaries, events use memoized row components, and only expanded sessions render their events in bounded batches of 100. Selecting an event opens transient details. Copy and Add to Deck call existing feature adapters; Run Again queues a one-time browser handoff, navigates to the terminal route, and executes through the existing visible `terminal.execute` pipeline after the matching Workspace terminal assignment is acknowledged.

## Persistence

SQLite is the only durable store. Use `better-sqlite3` as the Node.js driver and Drizzle for typed schema access and migrations. Enable foreign keys and WAL mode, and apply numbered schema migrations at application startup. FTS5 setup and other SQLite-specific features may use explicit SQL migrations where the schema tool does not model them directly.

Initial domain model:

| Entity                     | Purpose                                                               |
| -------------------------- | --------------------------------------------------------------------- |
| `workspaces`               | Root contexts with durable names and lifecycle metadata               |
| `workspace_terminal_state` | Last reported cwd and future terminal launch preferences by Workspace |
| `terminal_sessions`        | Historical lifecycle metadata for terminal tabs                       |
| `command_history`          | Immutable command, cwd, timing, completion, and exit data             |
| `command_definitions`      | Exact reusable command/template text with optional History provenance |
| `command_deck_items`       | Curated display name, description, order, and definition reference    |
| `tags` / `command_tags`    | User organization and filtering                                       |
| `quick_action_groups`      | Ordered sidebar groups                                                |
| `quick_actions`            | Reusable commands and insert/execute behavior                         |
| `workflows`                | Workflow identity, description, and version                           |
| `workflow_steps`           | Ordered commands and stop-on-failure rules                            |
| `workflow_runs`            | Execution history and outcome                                         |
| `settings`                 | Application-level preferences                                         |

An FTS5 index covers command text, searchable output, and notes. Workspace, date, status, tags, pins, and bookmarks remain structured filters rather than encoded search text.

Large outputs require a configurable persistence limit. The exact threshold should be chosen using Phase 0 load tests. When output is truncated, preserve useful beginning and ending segments and record that truncation occurred.

The database belongs in a configurable application-data directory, not in source control. Development data and test databases must be isolated from each other.

The first Workspace migration creates `Default Workspace`, assigns all existing History, definitions, and Deck items to it, and adds foreign keys with cascade cleanup. Workspace-leading indexes support active-context queries and counts. The migration rebuilds dependent tables in foreign-key order so existing data and provenance remain valid.

## Quick actions and workflows

A quick action has an explicit execution mode:

- `insert`: place the command in the active terminal for review.
- `execute`: send the command and newline after an explicit user action.

Potentially destructive defaults should use `insert` mode. There is no hidden or background command execution.

Initial workflows are ordered command steps, optional variables, and stop-on-failure behavior. They execute visibly in a terminal session and emit normal Command History entries. Parallel graphs, scheduling, background automation, and arbitrary plugin code are outside the current scope.

## Security model

CommandDeck has local code-execution capability by design. The initial security rules are therefore strict:

- Bind only to loopback by default.
- Reject WebSocket upgrades from unexpected origins.
- Use an unguessable per-launch or per-session connection token.
- Validate every HTTP and WebSocket payload at runtime.
- Never accept a client-provided shell executable without checking it against configured profiles.
- Normalize and validate workspace paths on the server.
- Do not render terminal output as unsanitized HTML.
- Do not log terminal input, environment variables, or command output in diagnostic logs by default.
- Provide clear confirmation semantics for executing stored actions.
- Close child processes during normal and abnormal shutdown paths.

Public network access, multi-user authentication, remote terminals, and collaboration require a new threat model and are not extensions of the localhost security assumptions.

## Performance and reliability

- Batch frequent PTY output events while preserving ordering.
- Apply node-pty flow control or bounded queues when the browser cannot keep up.
- Virtualize long Command History lists.
- Query and render only the active Workspace's History and Deck; abort superseded loads on switching.
- Derive Timeline Activity Sessions only from the active Workspace's queried History; memoize grouping and avoid rendering events inside collapsed sessions.
- Keep live PTY buffers out of global React state.
- Limit and visibly mark persisted output truncation.
- Use database transactions when finalizing commands and related search records.
- Mark running commands as interrupted during recovery after an unclean shutdown.
- Dispose PTYs, sockets, timers, parser state, and xterm.js instances deterministically.

## Testing strategy

1. **Unit tests:** protocol validation, streaming OSC parsing, reducers/stores, duration/status calculation, and command sanitization.
2. **Repository tests:** migrations, CRUD behavior, FTS queries, filters, and recovery using temporary SQLite databases.
3. **PTY integration tests:** real shell startup, input, resize, exit codes, multiline commands, large output, and interruption.
4. **Component tests:** History entries, Deck item editing and execution, terminal tabs, filters, and error states.
5. **End-to-end tests:** browser-to-WebSocket-to-PTY flows and persistence across restart.
6. **Packaged local runtime tests:** production build behavior on every supported operating system.

Use Vitest for unit and integration tests, React Testing Library for component behavior, and Playwright for browser end-to-end coverage. PTY integration suites should be isolated and serialized where native process behavior makes parallel execution unreliable.

## Explicitly deferred

- Electron or other desktop wrappers
- AI functionality
- Cloud storage and user accounts
- Remote terminal access
- Collaboration
- Plugin execution
- Workflow DAGs and background scheduling

None of these should add abstractions to the initial implementation before a real requirement exists.
