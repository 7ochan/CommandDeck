# CommandDeck

CommandDeck is a local-first visual terminal workspace where every executed command becomes a persistent, searchable, and reusable object instead of disappearing into terminal scrollback.

## Project status

The foundation scaffold is initialized and verified. It includes the Next.js App Router, TypeScript, Tailwind CSS, linting, formatting, the documented directory boundaries, and a loopback-only custom Node.js server.

Terminal transport and product functionality have not been implemented. xterm.js, node-pty, WebSockets, Zustand, and SQLite will be added only when their roadmap phases begin. Electron and AI functionality are outside the current implementation scope.

## Local development

Requirements:

- Node.js 22 or newer
- npm 11 or newer

```bash
npm install
npm run dev
```

The custom server listens on `http://127.0.0.1:3000` by default. Copy `.env.example` to `.env` when a different loopback port is needed.

## Available scripts

| Command                | Purpose                                                  |
| ---------------------- | -------------------------------------------------------- |
| `npm run dev`          | Start the local custom server in development/watch mode. |
| `npm run build`        | Build Next.js and compile the custom Node.js server.     |
| `npm start`            | Start the compiled production server.                    |
| `npm run lint`         | Run the Next.js ESLint configuration.                    |
| `npm run lint:fix`     | Apply safe ESLint fixes.                                 |
| `npm run format`       | Format supported files with Prettier.                    |
| `npm run format:check` | Check formatting without changing files.                 |
| `npm run typecheck`    | Run TypeScript without emitting output.                  |
| `npm run check`        | Run formatting, linting, types, and the full build.      |

## Documentation

- [Product vision](./Visual%20Terminal%20Workspace%20Vision%20v2.md)
- [System architecture](./docs/ARCHITECTURE.md)
- [Development roadmap](./docs/ROADMAP.md)
- [Proposed project structure](./docs/PROJECT_STRUCTURE.md)
- [Technical decision log](./docs/TECHNICAL_DECISIONS.md)

These documents are the implementation baseline. Architectural changes should update the relevant document and the technical decision log before code is changed.

## Current product boundary

- Runs locally on the same machine as the shell it controls.
- Uses a browser interface served from the local Node.js process.
- Does not expose terminal access to the public network.
- Does not use Electron during initial development.
- Does not include AI in the MVP or current roadmap.

The next implementation step is Phase 0 technical validation in the [roadmap](./docs/ROADMAP.md).
