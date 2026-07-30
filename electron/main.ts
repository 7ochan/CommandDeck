/**
 * Electron main process for CommandDeck.
 *
 * Architecture:
 * - Spawns the existing custom Node/Next.js server as a child process.
 * - Opens a BrowserWindow that loads the running HTTP server URL.
 * - Preserves the full existing server architecture (Next.js, WebSocket,
 *   node-pty, SQLite, Drizzle) without modification.
 *
 * Desktop polish (Phase 3):
 * - Native application icon wired from electron/assets/ (swap the files to
 *   change the icon — no code changes required).
 * - Startup loading window so the first frame is never blank.
 * - Per-platform icon selection (icns / ico / png).
 * - Graceful error dialogs for server failures and renderer crashes.
 * - Periodic window-state save (every 30 s) in addition to close-time save.
 * - Renderer crash recovery with a native dialog.
 */

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  shell,
  utilityProcess,
  type MenuItemConstructorOptions,
  type UtilityProcess,
} from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { createConnection } from 'node:net';
import { homedir, platform } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initAutoUpdater, checkForUpdates } from './updater.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── App identity ─────────────────────────────────────────────────────────────

app.name = 'CommandDeck';

// Windows: AppUserModelId is required for taskbar grouping and proper
// association of notifications/Jump Lists with the executable.
if (process.platform === 'win32') {
  app.setAppUserModelId('com.commanddeck.app');
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEV = !app.isPackaged;
const APP_HOST = '127.0.0.1';
const APP_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const APP_URL = `http://${APP_HOST}:${APP_PORT}`;

/** Background color matching the app's dark canvas (#0e0e0e from globals.css) */
const APP_BG = '#0e0e0e';

// ─── Icon resolution ──────────────────────────────────────────────────────────
//
// Icons live in electron/assets/. Replacing the files is the ONLY thing needed
// to change the application icon — no code changes required.
//
//   electron/assets/icon.icns   → macOS
//   electron/assets/icon.ico    → Windows
//   electron/assets/icon.png    → Linux (1024×1024 recommended)
//
// The assets directory is a sibling of the compiled .electron/ output dir.

function resolveIcon(): string | undefined {
  const assetsDir = join(__dirname, '..', 'electron', 'assets');

  if (process.platform === 'darwin') {
    const icns = join(assetsDir, 'icon.icns');
    if (existsSync(icns)) return icns;
  }

  if (process.platform === 'win32') {
    const ico = join(assetsDir, 'icon.ico');
    if (existsSync(ico)) return ico;
  }

  // Linux and fallback
  const png = join(assetsDir, 'icon.png');
  if (existsSync(png)) return png;

  return undefined;
}

const APP_ICON = resolveIcon();

// ─── IPC channel names ────────────────────────────────────────────────────────

const IPC = {
  /** Main → Renderer: open the Settings dialog */
  OPEN_SETTINGS: 'commanddeck:open-settings',
  /** Main → Renderer: trigger new workspace creation */
  NEW_WORKSPACE: 'commanddeck:new-workspace',
  /** Renderer → Main: open a native folder picker for workspace root */
  OPEN_WORKSPACE_FOLDER: 'commanddeck:open-workspace-folder',
  /** Renderer → Main: reveal the application data directory in Finder/Explorer */
  REVEAL_APP_DATA: 'commanddeck:reveal-app-data',
  /** Renderer → Main: reveal the database file in Finder/Explorer */
  REVEAL_DATABASE: 'commanddeck:reveal-database',
  /** Renderer → Main: reveal the logs folder (if present) */
  REVEAL_LOGS: 'commanddeck:reveal-logs',
  /** Renderer/Main: check for updates via electron-updater */
  CHECK_FOR_UPDATES: 'commanddeck:check-for-updates',
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
        width: Math.max(parsed.width ?? defaults.width, 800),
        height: Math.max(parsed.height ?? defaults.height, 600),
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
    if (win.isDestroyed()) return;

    const maximized = win.isMaximized();
    const fullscreen = win.isFullScreen();

    // When maximized or fullscreen, save normal bounds so the window reopens
    // at its last normal size/position.
    const { x, y, width, height } =
      maximized || fullscreen
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
let serverUtilityProcess: UtilityProcess | null = null;

/**
 * Starts the existing CommandDeck Node/Next.js server as a child process.
 *
 * In development: uses `tsx watch server.ts` (identical to `npm run dev`).
 * In production: uses Electron's official `utilityProcess.fork` to run
 * `.server/server.js --production` as a Node process inside Electron's Node runtime.
 * This prevents launching another Electron GUI executable process, solving the
 * recursive application spawning bug in packaged apps.
 *
 * If the server is already running (e.g. started via `npm run dev` in a
 * separate terminal), this function reuses the existing server.
 */
function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    // ── Path resolution ────────────────────────────────────────────────────
    //
    // Development:
    //   __dirname = <repo>/.electron/
    //   projectRoot = <repo>/
    //
    // Production (packaged, asar:false):
    //   process.resourcesPath = <App>.app/Contents/Resources/
    //   app root (where .server/, .next/, node_modules/ live) = Resources/app/
    //   __dirname = Resources/app/.electron/
    //   → projectRoot = join(__dirname, '..') works correctly
    //
    const projectRoot = join(__dirname, '..');
    let resolved = false;

    // 60 s hard timeout — show a proper dialog instead of hanging forever
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(
          new Error(
            'CommandDeck server did not start within 60 seconds.\n\n' +
              'This may indicate a port conflict or a server-side error. ' +
              'Check the logs for details.',
          ),
        );
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
                const lockFile = join(projectRoot, '.next', 'dev', 'lock');
                if (existsSync(lockFile)) {
                  try {
                    rmSync(lockFile, { force: true });
                  } catch {
                    // Non-fatal
                  }
                }
                reject(
                  new Error('Existing server reported but port is not open'),
                );
              }
            })
            .catch(reject);
        }, 1000);
      }
    };

    if (DEV) {
      const lockFile = join(projectRoot, '.next', 'dev', 'lock');
      if (existsSync(lockFile)) {
        isServerAlreadyRunning().then((running) => {
          if (!running) {
            try {
              rmSync(lockFile, { force: true });
              console.log('[Electron] Cleaned up stale .next/dev/lock file.');
            } catch {
              // Non-fatal
            }
          }
        }).catch(() => {});
      }

      const tsxBin = join(projectRoot, 'node_modules', '.bin', 'tsx');
      const command = tsxBin;
      const args = ['watch', join(projectRoot, 'server.ts')];

      console.log(
        `[Electron] Starting dev server: ${command} ${args.join(' ')}`,
      );

      const child = spawn(command, args, {
        cwd: projectRoot,
        env: {
          ...process.env,
          PORT: String(APP_PORT),
          COMMANDDECK_HOST: APP_HOST,
          NODE_PATH: join(projectRoot, 'node_modules'),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      serverProcess = child;

      child.stdout?.on('data', checkReady);
      child.stderr?.on('data', (data: Buffer) => {
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

      child.on('error', (err) => {
        console.error('[Electron] Failed to start dev server process:', err);
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(err);
        }
      });

      child.on('exit', (code, signal) => {
        console.log(
          `[Electron] Dev server process exited with code=${code} signal=${signal}`,
        );
        serverProcess = null;

        if (!resolved) {
          isServerAlreadyRunning()
            .then((running) => {
              if (running) {
                console.log(
                  '[Electron] Dev server exited but port is open — reusing existing server.',
                );
                markReady();
              } else {
                resolved = true;
                clearTimeout(timeout);
                reject(
                  new Error(
                    `Dev server process exited prematurely (code=${code} signal=${signal})`,
                  ),
                );
              }
            })
            .catch(() => {
              resolved = true;
              clearTimeout(timeout);
              reject(
                new Error(
                  `Dev server process exited prematurely (code=${code} signal=${signal})`,
                ),
              );
            });
        }
      });
    } else {
      // In production (packaged application), process.execPath is the executable of the
      // packaged Electron app bundle (e.g. CommandDeck.app/Contents/MacOS/CommandDeck).
      // Spawning process.execPath directly with ELECTRON_RUN_AS_NODE=1 fails because
      // macOS app bundle executables and fused Electron binaries ignore ELECTRON_RUN_AS_NODE,
      // launching a new Electron GUI instance instead of a Node process. This caused
      // infinite recursive application spawning.
      //
      // Using Electron's official utilityProcess.fork runs the compiled Node.js server
      // (.server/server.js) inside Electron's Node runtime as a headless background process,
      // completely bypassing the Electron GUI main process entry point.
      const serverScript = join(projectRoot, '.server', 'server.js');
      const args = ['--production'];

      console.log(
        `[Electron] Starting production utilityProcess server: ${serverScript} ${args.join(' ')}`,
      );

      const child = utilityProcess.fork(serverScript, args, {
        cwd: projectRoot,
        env: {
          ...process.env,
          PORT: String(APP_PORT),
          COMMANDDECK_HOST: APP_HOST,
          NODE_PATH: join(projectRoot, 'node_modules'),
        },
        stdio: 'pipe',
      });
      serverUtilityProcess = child;

      child.stdout?.on('data', checkReady);
      child.stderr?.on('data', (data: Buffer) => {
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

      child.on('error', (err) => {
        console.error(
          '[Electron] Failed to start production server utility process:',
          err,
        );
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(err);
        }
      });

      child.on('exit', (code) => {
        console.log(
          `[Electron] Production server utility process exited with code=${code}`,
        );
        serverUtilityProcess = null;

        if (!resolved) {
          isServerAlreadyRunning()
            .then((running) => {
              if (running) {
                console.log(
                  '[Electron] Server utility process exited but port is open — reusing existing server.',
                );
                markReady();
              } else {
                resolved = true;
                clearTimeout(timeout);
                reject(
                  new Error(
                    `Server utility process exited prematurely (code=${code})`,
                  ),
                );
              }
            })
            .catch(() => {
              resolved = true;
              clearTimeout(timeout);
              reject(
                new Error(
                  `Server utility process exited prematurely (code=${code})`,
                ),
              );
            });
        }
      });
    }
  });
}

function stopServer(): void {
  if (serverProcess) {
    console.log('[Electron] Stopping dev server process…');
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
  if (serverUtilityProcess) {
    console.log('[Electron] Stopping production server utility process…');
    serverUtilityProcess.kill();
    serverUtilityProcess = null;
  }
}

// ─── Error dialogs ─────────────────────────────────────────────────────────────

/**
 * Shows a native error dialog and optionally quits the application.
 */
async function showFatalError(
  title: string,
  message: string,
  detail?: string,
): Promise<void> {
  await dialog.showMessageBox({
    type: 'error',
    title,
    message,
    detail,
    buttons: ['Quit'],
    defaultId: 0,
  });
  app.quit();
}

/**
 * Shows a native warning dialog offering the user a chance to reload or quit.
 * Returns true if the user chose to reload.
 */
async function showRendererCrashDialog(): Promise<boolean> {
  const { response } = await dialog.showMessageBox({
    type: 'error',
    title: 'CommandDeck — Unexpected Error',
    message: 'The application encountered an unexpected error.',
    detail:
      'The renderer process crashed unexpectedly. You can try reloading the window or quit the application.',
    buttons: ['Reload', 'Quit'],
    defaultId: 0,
    cancelId: 1,
  });
  return response === 0;
}

// ─── Startup loading window ────────────────────────────────────────────────────
//
// Shown while the server is starting up. Hidden immediately once the main
// window is ready to show. Ensures the user always sees a polished first frame.

let loadingWindow: BrowserWindow | null = null;

function createLoadingWindow(): void {
  loadingWindow = new BrowserWindow({
    width: 340,
    height: 220,
    frame: false,
    resizable: false,
    movable: true,
    center: true,
    show: false,
    backgroundColor: APP_BG,
    transparent: false,
    alwaysOnTop: true,
    ...(APP_ICON ? { icon: APP_ICON } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Load the splash HTML inline via a data URL — no extra file needed
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:100%;height:100%;background:#0e0e0e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden;user-select:none;-webkit-app-region:drag}
  .wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:20px}
  .icon{font-size:40px;opacity:.9}
  .name{font-size:16px;font-weight:600;color:#f5f5f5;letter-spacing:.5px}
  .sub{font-size:12px;color:#6e6e6e;margin-top:-12px}
  .dots{display:flex;gap:6px;margin-top:4px}
  .dot{width:5px;height:5px;border-radius:50%;background:#424242;animation:pulse 1.4s ease-in-out infinite}
  .dot:nth-child(2){animation-delay:.2s}
  .dot:nth-child(3){animation-delay:.4s}
  @keyframes pulse{0%,80%,100%{transform:scale(1);background:#424242}40%{transform:scale(1.2);background:#9e9e9e}}
</style>
</head>
<body>
<div class="wrap">
  <div class="icon">›_</div>
  <div class="name">CommandDeck</div>
  <div class="sub">Starting…</div>
  <div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
</div>
</body>
</html>`;

  void loadingWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
  );

  loadingWindow.once('ready-to-show', () => {
    loadingWindow?.show();
  });

  loadingWindow.on('closed', () => {
    loadingWindow = null;
  });
}

function destroyLoadingWindow(): void {
  if (loadingWindow && !loadingWindow.isDestroyed()) {
    loadingWindow.close();
    loadingWindow = null;
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
      {
        label: 'Check for Updates…',
        click: () => void checkForUpdates(true),
      },
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
        click: () => sendToRenderer(IPC.NEW_WORKSPACE),
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

  // ── Go menu (Windows/Linux: contains Settings) ────────────────────────────
  const goMenu: MenuItemConstructorOptions = {
    label: 'Go',
    submenu: [
      {
        label: 'Settings',
        accelerator: 'CmdOrCtrl+,',
        click: () => sendToRenderer(IPC.OPEN_SETTINGS),
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
        label: 'Check for Updates…',
        click: () => void checkForUpdates(true),
      },
      { type: 'separator' },
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
        click: () => revealInFinder(app.getPath('logs')),
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
    const parent = dirname(target);
    if (existsSync(parent)) {
      shell.openPath(parent).catch(console.error);
    }
  }
}

/**
 * Opens a native folder-picker dialog. This is the "Open Workspace Folder"
 * action — it reveals the chosen folder in Finder/Explorer.
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
  ipcMain.handle(IPC.OPEN_WORKSPACE_FOLDER, async () => {
    await openWorkspaceFolder();
  });

  ipcMain.handle(IPC.REVEAL_APP_DATA, () => {
    revealInFinder(resolveDataDirectory());
  });

  ipcMain.handle(IPC.REVEAL_DATABASE, () => {
    revealInFinder(join(resolveDataDirectory(), 'commanddeck.db'));
  });

  ipcMain.handle(IPC.REVEAL_LOGS, () => {
    revealInFinder(app.getPath('logs'));
  });

  ipcMain.handle(IPC.CHECK_FOR_UPDATES, async () => {
    await checkForUpdates(true);
  });
}

// ─── Browser window ───────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let stateSaveInterval: ReturnType<typeof setInterval> | null = null;

function createWindow(): void {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    title: `CommandDeck v${app.getVersion()}`,
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 800,
    minHeight: 600,
    show: false, // Show only after content is ready — avoids any blank flash
    backgroundColor: APP_BG,
    ...(APP_ICON ? { icon: APP_ICON } : {}),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      // Disable the default spell-checker — reduces unnecessary background work
      spellcheck: false,
    },
  });

  // Restore maximized state
  if (state.maximized) {
    mainWindow.maximize();
  }

  // Open external HTTP/HTTPS links in the system browser, denying unexpected protocols
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          void shell.openExternal(url);
        }
      } catch {
        // Ignore invalid URLs
      }
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Prevent top-level frame navigation away from the application URL
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(APP_URL)) {
      event.preventDefault();
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          void shell.openExternal(url);
        }
      } catch {
        // Ignore invalid URLs
      }
    }
  });

  // Show window and destroy the loading splash once the page is ready
  mainWindow.once('ready-to-show', () => {
    destroyLoadingWindow();
    mainWindow?.show();
    mainWindow?.focus();

    // Perform non-blocking background update check after main window is ready
    void checkForUpdates(false);
  });

  // Periodic window-state save (every 30 s) so state survives unexpected exits
  stateSaveInterval = setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      saveWindowState(mainWindow);
    }
  }, 30_000);

  // Persist window state on close
  mainWindow.on('close', () => {
    if (mainWindow) {
      saveWindowState(mainWindow);
    }
    if (stateSaveInterval) {
      clearInterval(stateSaveInterval);
      stateSaveInterval = null;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // ── Renderer crash / GPU crash recovery ───────────────────────────────────

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Electron] Renderer process gone:', details.reason);

    // Unexpected crash — offer the user a chance to reload
    if (details.reason !== 'clean-exit') {
      showRendererCrashDialog()
        .then((shouldReload) => {
          if (shouldReload && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.reload();
          } else {
            app.quit();
          }
        })
        .catch(console.error);
    }
  });

  mainWindow.webContents.on('unresponsive', () => {
    console.warn('[Electron] Renderer is unresponsive.');
    dialog
      .showMessageBox({
        type: 'warning',
        title: 'CommandDeck — Not Responding',
        message: 'The application is not responding.',
        detail: 'Would you like to wait for it to recover or reload it?',
        buttons: ['Wait', 'Reload'],
        defaultId: 0,
      })
      .then(({ response }) => {
        if (response === 1 && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.reload();
        }
      })
      .catch(console.error);
  });

  void mainWindow.loadURL(APP_URL);
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.on('ready', async () => {
  // Initialize update service
  initAutoUpdater(APP_URL, () => mainWindow);

  // Register IPC handlers and build the menu before anything else so they
  // are ready the instant the window opens — no async gap.
  registerIpcHandlers();
  Menu.setApplicationMenu(buildMenu());

  // Show the loading window immediately so the user sees something right away
  createLoadingWindow();

  try {
    await startServer();
    createWindow();
  } catch (err) {
    console.error('[Electron] Failed to start CommandDeck:', err);
    destroyLoadingWindow();

    const message = err instanceof Error ? err.message : String(err);
    await showFatalError(
      'CommandDeck — Failed to Start',
      'CommandDeck could not start its server.',
      message,
    );
  }
});

// On macOS, re-create the window when the dock icon is clicked and there is no
// window open (but the server is still running).
app.on('activate', () => {
  if (mainWindow === null && serverProcess !== null) {
    createWindow();
  }
});

// Quit when all windows are closed (except on macOS where apps conventionally
// remain running until the user explicitly quits).
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopServer();
    app.quit();
  }
});

app.on('before-quit', () => {
  // Persist window state one final time before quitting
  if (mainWindow && !mainWindow.isDestroyed()) {
    saveWindowState(mainWindow);
  }
  if (stateSaveInterval) {
    clearInterval(stateSaveInterval);
    stateSaveInterval = null;
  }
  stopServer();
});

// Catch any unhandled promise rejections in the main process and log them
// without crashing the entire application.
process.on('unhandledRejection', (reason) => {
  console.error('[Electron] Unhandled promise rejection:', reason);
});
