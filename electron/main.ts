/**
 * Electron main process for CommandDeck.
 *
 * Architecture:
 * - Spawns the existing custom Node/Next.js server as a child process.
 * - Opens a BrowserWindow that loads the running HTTP server URL.
 * - Preserves the full existing server architecture (Next.js, WebSocket,
 *   node-pty, SQLite, Drizzle) without modification.
 *
 * Phase 2 additions:
 * - Native application menus (macOS, Windows, Linux).
 * - IPC bridge for opening Settings from the menu (Cmd+,).
 * - Native filesystem actions: open workspace folder, reveal app data, etc.
 * - Maximized state persistence.
 */

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  shell,
  type MenuItemConstructorOptions,
} from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createConnection } from 'node:net';
import { homedir, platform } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── App identity ─────────────────────────────────────────────────────────────

app.name = 'CommandDeck';

// Windows: sets the app user model ID used for taskbar grouping / notifications
if (process.platform === 'win32') {
  app.setAppUserModelId('com.commanddeck.app');
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEV = !app.isPackaged;
const APP_HOST = '127.0.0.1';
const APP_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const APP_URL = `http://${APP_HOST}:${APP_PORT}`;

// ─── IPC channel names ────────────────────────────────────────────────────────

const IPC = {
  /** Main → Renderer: open the Settings dialog */
  OPEN_SETTINGS: 'commanddeck:open-settings',
  /** Renderer → Main: open a native folder picker for workspace root */
  OPEN_WORKSPACE_FOLDER: 'commanddeck:open-workspace-folder',
  /** Renderer → Main: reveal the application data directory in Finder/Explorer */
  REVEAL_APP_DATA: 'commanddeck:reveal-app-data',
  /** Renderer → Main: reveal the database file in Finder/Explorer */
  REVEAL_DATABASE: 'commanddeck:reveal-database',
  /** Renderer → Main: reveal the logs folder (if present) */
  REVEAL_LOGS: 'commanddeck:reveal-logs',
} as const;

// ─── Window state persistence ─────────────────────────────────────────────────

const STATE_FILE = join(app.getPath('userData'), 'window-state.json');

type WindowState = {
  x?: number;
  y?: number;
  width: number;
  height: number;
  maximized: boolean;
};

function loadWindowState(): WindowState {
  const defaults: WindowState = {
    width: 1280,
    height: 800,
    maximized: false,
  };

  try {
    if (existsSync(STATE_FILE)) {
      const raw = readFileSync(STATE_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Partial<WindowState>;
      return {
        x: parsed.x,
        y: parsed.y,
        width: parsed.width ?? defaults.width,
        height: parsed.height ?? defaults.height,
        maximized: parsed.maximized ?? defaults.maximized,
      };
    }
  } catch {
    // Ignore malformed state files; fall back to defaults.
  }

  return defaults;
}

function saveWindowState(win: BrowserWindow): void {
  try {
    const maximized = win.isMaximized();
    // When maximized, save the restored (normal) bounds so the window reopens
    // at its last normal size/position when restored.
    const { x, y, width, height } = maximized
      ? (win.getNormalBounds?.() ?? win.getBounds())
      : win.getBounds();

    const stateDir = dirname(STATE_FILE);
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(
      STATE_FILE,
      JSON.stringify({ x, y, width, height, maximized }),
      'utf8',
    );
  } catch {
    // Non-fatal — window state save failures should never crash the app.
  }
}

// ─── Server management ────────────────────────────────────────────────────────

/**
 * Checks if the CommandDeck server is already listening on the configured port.
 */
function isServerAlreadyRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: APP_HOST, port: APP_PORT });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      resolve(false);
    });
  });
}

let serverProcess: ChildProcess | null = null;

/**
 * Starts the existing CommandDeck Node/Next.js server as a child process.
 *
 * In development: uses `tsx watch server.ts` (identical to `npm run dev`).
 * In production: uses the compiled `node .server/server.js --production`.
 *
 * If the server is already running (e.g. started via `npm run dev` in a
 * separate terminal), this function reuses the existing server.
 */
function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const projectRoot = DEV
      ? join(__dirname, '..') // .electron/main.js → project root
      : join(__dirname, '..', '..'); // packaged dist → project root

    let command: string;
    let args: string[];

    if (DEV) {
      const tsxBin = join(projectRoot, 'node_modules', '.bin', 'tsx');
      command = tsxBin;
      args = ['watch', join(projectRoot, 'server.ts')];
    } else {
      command = process.execPath;
      args = [join(projectRoot, '.server', 'server.js'), '--production'];
    }

    console.log(`[Electron] Starting server: ${command} ${args.join(' ')}`);

    serverProcess = spawn(command, args, {
      cwd: projectRoot,
      env: {
        ...process.env,
        PORT: String(APP_PORT),
        COMMANDDECK_HOST: APP_HOST,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error('CommandDeck server did not start within 60 seconds'));
      }
    }, 60_000);

    const markReady = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve();
      }
    };

    const checkReady = (data: Buffer) => {
      const text = data.toString();
      process.stdout.write(`[server] ${text}`);

      if (text.includes('CommandDeck is ready at')) {
        markReady();
        return;
      }

      if (text.includes('Another next dev server is already running')) {
        console.log('[Electron] Existing server detected — reusing it.');
        setTimeout(() => {
          isServerAlreadyRunning()
            .then((running) => {
              if (running) {
                markReady();
              } else {
                reject(
                  new Error('Existing server reported but port is not open'),
                );
              }
            })
            .catch(reject);
        }, 1000);
      }
    };

    serverProcess.stdout?.on('data', checkReady);
    serverProcess.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      process.stderr.write(`[server] ${text}`);

      if (text.includes('CommandDeck is ready at')) {
        markReady();
        return;
      }

      if (text.includes('Another next dev server is already running')) {
        console.log('[Electron] Existing server detected — reusing it.');
        setTimeout(() => {
          isServerAlreadyRunning()
            .then((running) => {
              if (running) markReady();
              else
                reject(
                  new Error('Existing server reported but port is not open'),
                );
            })
            .catch(reject);
        }, 1000);
      }
    });

    serverProcess.on('error', (err) => {
      console.error('[Electron] Failed to start server process:', err);
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    serverProcess.on('exit', (code, signal) => {
      console.log(
        `[Electron] Server process exited with code=${code} signal=${signal}`,
      );
      serverProcess = null;

      if (!resolved) {
        isServerAlreadyRunning()
          .then((running) => {
            if (running) {
              console.log(
                '[Electron] Server process exited but port is open — reusing existing server.',
              );
              markReady();
            } else {
              resolved = true;
              clearTimeout(timeout);
              reject(
                new Error(
                  `Server process exited prematurely (code=${code} signal=${signal})`,
                ),
              );
            }
          })
          .catch(() => {
            resolved = true;
            clearTimeout(timeout);
            reject(
              new Error(
                `Server process exited prematurely (code=${code} signal=${signal})`,
              ),
            );
          });
      }
    });
  });
}

function stopServer(): void {
  if (serverProcess) {
    console.log('[Electron] Stopping server process…');
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

// ─── Native application menu ──────────────────────────────────────────────────

/**
 * Resolves the default data directory used by CommandDeck's SQLite database,
 * mirroring the logic in src/server/db/client.ts so we can reveal it from
 * the main process without importing server code.
 */
function resolveDataDirectory(): string {
  const configured = process.env.COMMANDDECK_DATA_DIR;
  if (configured) return configured;

  if (platform() === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'CommandDeck');
  }
  if (platform() === 'win32') {
    return join(
      process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'),
      'CommandDeck',
    );
  }
  return join(
    process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'),
    'commanddeck',
  );
}

function buildMenu(): Menu {
  const isMac = process.platform === 'darwin';

  // ── macOS app menu ────────────────────────────────────────────────────────
  const macAppMenu: MenuItemConstructorOptions = {
    label: app.name,
    submenu: [
      { role: 'about', label: `About ${app.name}` },
      { type: 'separator' },
      {
        label: 'Settings…',
        accelerator: 'CmdOrCtrl+,',
        click: () => sendToRenderer(IPC.OPEN_SETTINGS),
      },
      { type: 'separator' },
      { role: 'hide', label: `Hide ${app.name}` },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit', label: `Quit ${app.name}` },
    ],
  };

  // ── File menu ─────────────────────────────────────────────────────────────
  const fileMenu: MenuItemConstructorOptions = {
    label: 'File',
    submenu: [
      {
        label: 'New Workspace',
        accelerator: 'CmdOrCtrl+Shift+N',
        click: () => sendToRenderer('commanddeck:new-workspace'),
      },
      { type: 'separator' },
      {
        label: 'Open Workspace Folder…',
        accelerator: 'CmdOrCtrl+Shift+O',
        click: () => openWorkspaceFolder(),
      },
      { type: 'separator' },
      isMac ? { role: 'close', label: 'Close Window' } : { role: 'quit' },
    ],
  };

  // ── Edit menu (standard) ──────────────────────────────────────────────────
  const editMenu: MenuItemConstructorOptions = {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
    ],
  };

  // ── View menu ─────────────────────────────────────────────────────────────
  const viewSubmenu: MenuItemConstructorOptions[] = [
    {
      label: 'Reload',
      accelerator: 'CmdOrCtrl+R',
      click: () => mainWindow?.webContents.reload(),
    },
    { type: 'separator' },
    { role: 'togglefullscreen' },
  ];

  if (DEV) {
    viewSubmenu.push(
      { type: 'separator' },
      { role: 'toggleDevTools', label: 'Toggle Developer Tools' },
    );
  }

  const viewMenu: MenuItemConstructorOptions = {
    label: 'View',
    submenu: viewSubmenu,
  };

  // ── Go menu ───────────────────────────────────────────────────────────────
  const goMenu: MenuItemConstructorOptions = {
    label: 'Go',
    submenu: [
      {
        label: 'Settings',
        accelerator: 'CmdOrCtrl+,',
        click: () => sendToRenderer(IPC.OPEN_SETTINGS),
        // Hide on macOS — the app menu entry is canonical there
        visible: !isMac,
      },
    ],
  };

  // ── Window menu ───────────────────────────────────────────────────────────
  const windowMenu: MenuItemConstructorOptions = {
    label: 'Window',
    role: 'window',
    submenu: [
      { role: 'minimize' },
      { role: 'zoom' },
      ...(isMac
        ? [
            { type: 'separator' as const },
            { role: 'front' as const },
            { type: 'separator' as const },
            { role: 'window' as const },
          ]
        : [{ role: 'close' as const }]),
    ],
  };

  // ── Help menu ─────────────────────────────────────────────────────────────
  const helpMenu: MenuItemConstructorOptions = {
    label: 'Help',
    role: 'help',
    submenu: [
      {
        label: 'Reveal Application Data…',
        click: () => revealInFinder(resolveDataDirectory()),
      },
      {
        label: 'Reveal Database File…',
        click: () =>
          revealInFinder(join(resolveDataDirectory(), 'commanddeck.db')),
      },
      {
        label: 'Reveal Logs Folder…',
        click: () => {
          const logsDir = app.getPath('logs');
          revealInFinder(logsDir);
        },
      },
    ],
  };

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [macAppMenu] : []),
    fileMenu,
    editMenu,
    viewMenu,
    ...(isMac ? [] : [goMenu]),
    windowMenu,
    helpMenu,
  ];

  return Menu.buildFromTemplate(template);
}

/** Sends an IPC message to the focused or main BrowserWindow renderer. */
function sendToRenderer(channel: string): void {
  const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel);
  }
}

/** Reveals a path in Finder/Explorer. Falls back to opening the directory. */
function revealInFinder(target: string): void {
  if (existsSync(target)) {
    shell.showItemInFolder(target);
  } else {
    // If the specific file doesn't exist, open the nearest parent that does
    const parent = dirname(target);
    if (existsSync(parent)) {
      shell.openPath(parent).catch(console.error);
    }
  }
}

/**
 * Opens a native folder-picker dialog and reveals the selected folder in
 * Finder/Explorer. This is the "Open Workspace Folder" action.
 */
async function openWorkspaceFolder(): Promise<void> {
  const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
  if (!win) return;

  const result = await dialog.showOpenDialog(win, {
    title: 'Open Workspace Folder',
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Open in CommandDeck',
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const folderPath = result.filePaths[0];
    if (folderPath) {
      shell.openPath(folderPath).catch(console.error);
    }
  }
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────

function registerIpcHandlers(): void {
  // Renderer → Main: open a workspace folder picker
  ipcMain.handle(IPC.OPEN_WORKSPACE_FOLDER, async () => {
    await openWorkspaceFolder();
  });

  // Renderer → Main: reveal app data directory
  ipcMain.handle(IPC.REVEAL_APP_DATA, () => {
    revealInFinder(resolveDataDirectory());
  });

  // Renderer → Main: reveal database file
  ipcMain.handle(IPC.REVEAL_DATABASE, () => {
    revealInFinder(join(resolveDataDirectory(), 'commanddeck.db'));
  });

  // Renderer → Main: reveal logs folder
  ipcMain.handle(IPC.REVEAL_LOGS, () => {
    revealInFinder(app.getPath('logs'));
  });
}

// ─── Browser window ───────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    title: 'CommandDeck',
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 800,
    minHeight: 600,
    show: false, // Show only after content is ready to avoid blank flash
    backgroundColor: '#0a0a0f', // Match the app's dark background
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  // Restore maximized state after window is created
  if (state.maximized) {
    mainWindow.maximize();
  }

  // Open external links in the system browser, not inside Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) {
      void shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Show window once the page has finished loading (avoids blank flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Persist window state on close
  mainWindow.on('close', () => {
    if (mainWindow) {
      saveWindowState(mainWindow);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  void mainWindow.loadURL(APP_URL);
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.on('ready', async () => {
  // Register IPC handlers before creating the window
  registerIpcHandlers();

  // Build and apply the native application menu
  const menu = buildMenu();
  Menu.setApplicationMenu(menu);

  try {
    await startServer();
    createWindow();
  } catch (err) {
    console.error('[Electron] Failed to start CommandDeck:', err);
    app.quit();
  }
});

// On macOS, re-create the window when the dock icon is clicked
app.on('activate', () => {
  if (mainWindow === null && serverProcess !== null) {
    createWindow();
  }
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopServer();
    app.quit();
  }
});

app.on('before-quit', () => {
  stopServer();
});
