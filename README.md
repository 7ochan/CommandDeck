# CommandDeck

CommandDeck is a local-first multi-workspace terminal environment where each Workspace owns immutable Command History and an editable, persistent Command Deck.

## Project status

The terminal, shell integration, Workspaces, Command History, Command Deck, and Workspace Timeline vertical slice are initialized and verified. A default Workspace is created automatically and existing data migrates into it. Completed zsh commands are assigned to the Workspace selected for that terminal execution and persist as immutable History. Each Workspace loads only its own searchable History, curated Deck, and dynamically grouped Timeline. Deck commands may use validated `{{variable}}` placeholders that are resolved immediately before execution without changing the stored template.

Zustand, broad output/note search, Electron, and AI functionality have not been implemented.

## Local development

Requirements:

- Node.js 22 or newer
- npm 11 or newer

```bash
npm install
npm run dev
```

The custom server listens on `http://127.0.0.1:3000` by default. Workspaces, Command History, and Deck data are stored in the operating system's application data directory. Copy `.env.example` to `.env` to change the loopback port or set `COMMANDDECK_DATA_DIR`.

## Available scripts

| Command                   | Purpose                                                    |
| ------------------------- | ---------------------------------------------------------- |
| `npm run dev`             | Start the local custom server in development/watch mode.   |
| `npm run build`           | Build Next.js and compile the custom Node.js server.       |
| `npm start`               | Start the compiled production server.                      |
| `npm run lint`            | Run the Next.js ESLint configuration.                      |
| `npm run lint:fix`        | Apply safe ESLint fixes.                                   |
| `npm run format`          | Format supported files with Prettier.                      |
| `npm run format:check`    | Check formatting without changing files.                   |
| `npm test`                | Run unit and integration tests with Vitest.                |
| `npm run typecheck`       | Run TypeScript without emitting output.                    |
| `npm run check`           | Run formatting, linting, types, tests, and the full build. |
| `npm run verify:terminal` | Verify terminal behavior and persistence across restart.   |

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

The project is implementing the Phase 2 Command History, Deck, and Timeline vertical slice in the [roadmap](./docs/ROADMAP.md).
