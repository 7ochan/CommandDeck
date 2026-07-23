# Proposed Project Structure

## Purpose

This is the folder structure future implementation should follow. It is a feature-oriented Next.js application with clearly separated browser, shared-contract, and server-only code. The directories described here should be created only when implementation begins.

```text
command-deck/
├── server.ts                       # Local Node composition root and HTTP server
├── next.config.ts
├── package.json
├── tsconfig.json
├── public/
│   ├── icons/
│   └── fonts/
├── scripts/
│   ├── build-server.ts             # Production build support when needed
│   └── verify-native-deps.ts       # node-pty platform checks when needed
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── api/                    # Durable HTTP route handlers
│   │   │   ├── commands/
│   │   │   ├── quick-actions/
│   │   │   ├── settings/
│   │   │   ├── workflows/
│   │   │   └── workspaces/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── layout/                 # Shared application layout primitives
│   │   └── ui/                     # Generic accessible UI primitives
│   ├── features/
│   │   ├── command-cards/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── api.ts
│   │   │   └── types.ts
│   │   ├── quick-actions/
│   │   ├── terminal/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── terminal-store.ts
│   │   │   └── terminal-client.ts
│   │   ├── timeline/
│   │   ├── workflows/
│   │   └── workspaces/
│   ├── lib/                        # Browser-safe utilities and configuration
│   ├── server/                     # Never imported by client components
│   │   ├── api/                    # Route-handler adapters and validation
│   │   ├── application/            # Use cases shared by HTTP and WebSocket
│   │   ├── commands/
│   │   │   ├── command-capture.ts
│   │   │   └── command-service.ts
│   │   ├── db/
│   │   │   ├── client.ts
│   │   │   ├── schema.ts
│   │   │   ├── migrations/
│   │   │   ├── repositories/
│   │   │   └── sqlite/              # FTS5 and SQLite-specific helpers
│   │   ├── runtime/                # Service initialization and shutdown
│   │   ├── shell-integration/
│   │   │   ├── parsers/
│   │   │   ├── scripts/
│   │   │   └── shell-profiles.ts
│   │   ├── terminal/
│   │   │   ├── pty-adapter.ts
│   │   │   ├── terminal-session.ts
│   │   │   └── terminal-session-manager.ts
│   │   └── websocket/
│   │       ├── connection-registry.ts
│   │       ├── terminal-gateway.ts
│   │       └── websocket-server.ts
│   └── shared/
│       ├── contracts/              # Versioned HTTP and WebSocket contracts
│       ├── schemas/                # Runtime validation shared across boundary
│       └── types/                  # Pure domain types with no runtime imports
├── tests/
│   ├── e2e/
│   ├── fixtures/
│   │   ├── shell-output/
│   │   └── workspaces/
│   ├── integration/
│   │   ├── db/
│   │   ├── pty/
│   │   └── websocket/
│   └── unit/
│       ├── client/
│       └── server/
└── docs/
    ├── ARCHITECTURE.md
    ├── PROJECT_STRUCTURE.md
    ├── ROADMAP.md
    └── TECHNICAL_DECISIONS.md
```

## Boundary rules

### `src/app`

Contains Next.js routes, layouts, pages, and thin HTTP route-handler adapters. Route handlers validate transport input and invoke application services; they should not contain SQL or PTY logic.

### `src/features`

Contains browser-facing product features. A feature may own components, hooks, browser API adapters, and local types. Features should communicate with the server through shared contracts rather than importing server implementations.

### `src/components/ui`

Contains genuinely reusable, domain-neutral components. Command cards and terminal tabs belong in their features, not in the generic component folder.

### `src/server`

Contains all privileged and server-only code: node-pty, filesystem access, SQLite through better-sqlite3 and Drizzle, shell integration, `ws` connections, and process lifecycle. Files in this directory must be protected with server-only imports where appropriate and must never enter a client bundle.

### `src/shared`

Contains only code that is safe in both browser and Node.js runtimes. It may define serializable domain types, event envelopes, and Zod runtime schemas. It must not import React, Next.js server modules, node-pty, database drivers, or filesystem APIs.

### `server.ts`

Is a small composition root, not a general business-logic file. It creates the HTTP server, prepares Next.js, attaches WebSocket upgrades, initializes services, and registers shutdown handling. Product logic belongs under `src/server`.

## Dependency direction

```text
app/features ───────► shared contracts ◄────── server adapters
                                              │
                                              ▼
                                      application services
                                              │
                         ┌────────────────────┼────────────────────┐
                         ▼                    ▼                    ▼
                    terminal/pty       repositories/db     shell integration
```

Dependencies point inward toward domain contracts and application services. Infrastructure modules may implement application interfaces; application services should not depend directly on Next.js request objects or React state.

## State ownership

| State | Owner |
|---|---|
| Active node-pty process | Server terminal manager |
| Command-capture state machine | Server terminal session |
| Durable cards, actions, workflows | SQLite through repositories |
| WebSocket connection status | Zustand terminal store |
| Open tabs and selected tab | Zustand terminal store, reconciled with server |
| xterm.js instance and live buffer | Terminal React component/ref |
| Timeline filters and selected card | Feature-level Zustand store or URL state |

The raw xterm.js buffer must not be copied into Zustand. High-frequency PTY output should travel directly from the terminal client adapter to the relevant xterm.js instance.

## Testing placement

- Place pure parser and state-machine tests beside the relevant unit-test area.
- Use fixture files for deliberately fragmented OSC sequences and representative shell output.
- Run database tests against temporary databases, never the development database.
- Run PTY integration tests serially where node-pty thread-safety or shell state requires it.
- Keep end-to-end tests focused on user-visible flows across the real WebSocket boundary.

## Runtime data

Runtime data does not belong in the source tree. The future implementation should support a configurable data directory and use separate locations for development, tests, and normal use. Database files, WAL files, logs, sockets, generated shell scripts, and captured output artifacts must be excluded from version control.

## Structure to avoid

- A second independently deployed backend service
- Generic `utils` folders containing unrelated behavior
- SQL inside React components or route handlers
- node-pty imports anywhere in browser code
- One global Zustand store containing terminal output and durable entities
- Duplicate domain types defined separately for HTTP, WebSocket, and UI
- Premature plugin, remote-terminal, desktop-wrapper, or AI directories
