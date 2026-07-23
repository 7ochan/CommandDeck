# CommandDeck

CommandDeck is a local-first visual terminal workspace where every executed command becomes a persistent, searchable, and reusable object instead of disappearing into terminal scrollback.

## Project status

The project is currently in architecture and planning. No application has been initialized yet.

The initial product will be a locally served web application built with Next.js, Node.js, TypeScript, xterm.js, node-pty, Zustand, and SQLite. Electron and AI functionality are outside the current implementation scope.

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

Implementation should begin with Phase 0 in the [roadmap](./docs/ROADMAP.md) after this documentation baseline is approved.
