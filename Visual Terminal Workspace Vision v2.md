# Vision v2 — Visual Terminal Workspace

## Core Identity

> **A terminal where every command becomes a reusable visual object instead of disappearing into scrollback.**

Everything else exists to support this idea.

---

## MVP (Build These First)

### 1. Browser Terminal (Foundation)
- Fully functional terminal in the browser
- Connects to the user's local shell
- Multiple tabs
- Resize support

**Nothing fancy yet. Just make it reliable.**

---

### 2. Visual Command Cards ⭐ (Main Feature)

Every executed command becomes its own card.

Each card contains:
- Command
- Output
- Exit status
- Execution time
- Timestamp

Actions:
- Pin
- Bookmark
- Copy
- Search
- Re-run
- Add Note
- Convert to Workflow

This is the product's identity.

---

### 3. Quick Action Sidebar

A customizable sidebar with one-click actions.

Examples:
- Git Status
- Git Pull
- Git Push
- Git Commit
- npm install
- npm run dev
- docker compose up
- docker compose down

Users can:
- Add buttons
- Reorder buttons
- Group buttons
- Choose icons

---

### 4. Searchable Timeline

Instead of terminal history:

- Search commands
- Filter by project
- Filter by date
- Filter by tags
- Jump back instantly

---

### 5. AI Assistant (Only Where Useful)

AI should never be a chatbot.

Useful actions:
- Explain this error
- Summarize long logs
- Suggest next command
- Convert repeated commands into a reusable workflow
- Explain unfamiliar terminal output

---

## Future Features

- Workspace snapshots
- Project notes
- Workspace modes
- Plugins
- Collaboration
- Remote terminals

---

## Suggested Build Order

Phase 1
- Browser terminal
- PTY backend
- WebSocket communication

Phase 2
- Command detection
- Command cards
- Persistence

Phase 3
- Sidebar buttons
- Timeline
- Search

Phase 4
- AI actions

Phase 5
- Polish
- Themes
- Animations
- Deploy

---

## Product Pitch

A browser-based terminal workspace where commands become searchable,
reusable, and AI-assisted workflow objects instead of disappearing forever.
