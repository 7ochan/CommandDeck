# CommandDeck Development Roadmap

## How to use this roadmap

Development advances through capability gates, not calendar dates. A phase is complete only when its acceptance criteria pass in an actual browser against a real local shell. Features from later phases should not be pulled forward unless they remove a demonstrated blocker.

The initial reference platform is macOS with zsh. Cross-platform work begins after the Command History and Deck vertical slice is reliable.

## Phase 0 — Technical validation

### Goal

Prove the highest-risk terminal and command-capture assumptions with the smallest possible vertical experiment.

### Scope

- Initialize the future Next.js and TypeScript project.
- Start it through the local custom Node.js server.
- Attach one authenticated, loopback-only WebSocket endpoint.
- Spawn one zsh session using node-pty.
- Render it with xterm.js and fit it on resize.
- Send input and receive ordered output.
- Inject a minimal shell-integration script.
- Detect command text, start, completion, exit code, and working directory.
- Exercise normal, failed, multiline, long-running, high-output, and interactive commands.
- Record architectural findings before proceeding.

### Exit criteria

- A real shell behaves normally in the browser.
- Resize works without corrupting display state.
- At least the agreed command fixture set is captured without prompt regexes.
- PTY and WebSocket resources close cleanly.
- Interactive applications remain usable even if their output is not History-compatible.
- The team has measured output throughput and selected an initial capture-limit policy.

## Phase 1 — Terminal foundation

### Goal

Build a reliable multi-tab terminal workspace before adding durable History and Deck data.

### Scope

- Application shell and workspace layout
- Terminal session manager
- Multiple terminal tabs
- Create, activate, rename, and close tab behavior
- Terminal resize and focus behavior
- Configured shell profiles and starting directories
- WebSocket protocol schemas and versioning
- Connection, disconnect, reconnect, and error states
- Graceful server shutdown and child-process cleanup
- Unit and PTY integration test foundations

### Exit criteria

- Multiple terminals can run concurrently without mixed output.
- Every input, resize, and output event is associated with the correct session.
- Closing a tab terminates its PTY exactly once.
- Server shutdown leaves no managed shell processes behind.
- The UI communicates connection failures without losing control of other tabs.

## Phase 2 — Command History and Deck vertical slice

### Goal

Deliver the smallest complete version of the product's defining feature.

### Scope

- Production-quality shell-integration parser for zsh
- Command lifecycle state machine
- Live running and completed History states
- Command, output, cwd, timestamp, duration, exit code, and status
- Interrupted and capture-unavailable states
- Copy command and copy output
- Deliberate re-run through the active managed terminal session
- Initial SQLite schema, migrations, and repositories
- Persist History and load it after restart
- Curated persistent Command Deck referencing reusable definitions
- Add from History; edit, remove, and execute Deck items
- Validated Command Templates with ordered variable prompts and execution preview
- Basic History-list virtualization
- Early command/cwd live search and success, failed, and interrupted filters

### Exit criteria

- Supported non-interactive commands produce one correctly bounded History entry each.
- Commands remain linked to the correct session and workspace.
- Completed History and curated Deck items survive a server restart.
- Failed and interrupted commands have accurate status.
- Unsupported capture degrades visibly without breaking the terminal.
- A long History list remains responsive.
- Combined command/cwd search and status filters return accurate History entries without breaking History or Deck actions.
- Editing or removing a Deck item never changes its source History entry.
- Deck execution is visible and produces a new History entry.
- Template placeholders are detected automatically, resolved once per distinct case-sensitive name, previewed, and expanded without mutating the stored Deck definition.

### Milestone

**MVP Alpha:** CommandDeck demonstrates its unique terminal-to-History-to-Deck workflow end to end.

## Phase 3 — Durable organization

### Goal

Turn captured History into deeply organized personal terminal context.

### Scope

- Workspace creation and project-root association
- Notes, tags, pin, and bookmark actions
- SQLite FTS5 index
- Extend search across command, output, and notes
- Date, workspace, status, tag, pin, and bookmark filters
- History navigation and entry detail view
- Large-output truncation behavior
- Recovery of commands left running after an unclean shutdown
- Database backup/export baseline

### Exit criteria

- Search results remain correct after create, update, and delete operations.
- Combined structured filters behave predictably.
- Notes and organization survive restart.
- Search latency remains acceptable against the agreed large-history fixture.
- Truncated output is clearly labeled and never presented as complete.

## Phase 4 — Quick actions and workflows

### Goal

Make useful commands deliberately reusable without creating an automation platform.

### Scope

- Quick-action create, edit, delete, reorder, group, and icon selection
- Explicit insert-versus-execute action mode
- Convert a History entry or Deck item into a quick action
- Ordered workflow definitions
- Workflow variables with preview before execution
- Stop-on-failure behavior
- Visible workflow execution in a terminal
- Workflow-run history
- Convert selected or repeated History entries or Deck items into a draft workflow

### Exit criteria

- No stored action executes through an ambiguous interaction.
- Workflow steps create ordinary History entries.
- Failure stops or continues exactly according to the saved rule.
- Variables are resolved and shown before commands are sent.
- A failed workflow can be understood from its History entries and workflow-run history.

### Milestone

**MVP Complete:** terminal, History, Command Deck, persistence, search, quick actions, and simple workflows form one coherent product.

## Phase 5 — Reliability and broader shell support

### Goal

Make the MVP dependable outside the initial development setup.

### Scope

- Bash support
- Fish support
- Windows PowerShell and ConPTY support
- Shell compatibility test matrix
- Native node-pty build verification per operating system
- High-volume output backpressure and stress tests
- Accessibility and keyboard navigation
- Database migration, backup, restore, and corruption handling
- Private-history or capture-exclusion controls
- Security review of origin, tokens, paths, API validation, and logging

### Exit criteria

- Every supported shell passes the shared command-capture fixture suite.
- Supported operating systems pass production-build smoke tests.
- Large output cannot cause unbounded memory growth.
- Keyboard-only users can operate the terminal workspace, History, and Deck.
- Upgrade and recovery procedures have automated coverage.

## Phase 6 — Final product and portfolio release

### Goal

Finish the core experience to release quality and present it convincingly.

### Scope

- Visual design system, responsive workspace layout, and themes
- Purposeful motion and terminal-safe focus behavior
- Empty, loading, failure, disconnected, and recovery states
- Onboarding and shell-integration diagnostics
- Settings and data-management interface
- Performance profiling and final optimization
- Production documentation and architecture diagrams
- User testing against representative terminal tasks
- Evaluation metrics and recorded demonstration
- Signed-off release checklist

### Exit criteria

- All MVP capabilities meet documented acceptance tests.
- No critical terminal lifecycle, data-loss, or command-capture defects remain.
- The product communicates unsupported states rather than silently failing.
- A new user can start the local server, open a shell, search History, curate a Deck item, and reuse a workflow from documented instructions.
- The portfolio presentation explains both product value and engineering trade-offs.

### Milestone

**Core Product Complete:** only at this point may deferred product directions be reconsidered.

## Deferred beyond the current roadmap

- Electron packaging
- AI functionality
- Remote terminals
- Collaboration
- Plugins
- Cloud synchronization and accounts
- Scheduled or background workflows
- Visual workflow graphs

Any deferred feature requires a new product decision, threat-model review, architecture update, and its own roadmap before implementation.

## Definition of done for every phase

- Acceptance criteria are demonstrably met.
- Relevant unit, integration, and end-to-end tests pass.
- Failure and cleanup behavior is covered, not only the happy path.
- Schema and protocol changes are migrated and documented.
- No secrets, runtime data, or generated artifacts are committed.
- Architecture and decision documents reflect material changes.
- Deferred scope has not entered the implementation accidentally.
