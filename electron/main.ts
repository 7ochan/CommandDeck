/**
 * Electron main process for CommandDeck.
 *
 * Architecture:
 * - Spawns the existing custom Node/Next.js server as a child process.
 * - Opens a BrowserWindow that loads the running HTTP server URL.
 * - Preserves the full existing server architecture (Next.js, WebSocket,
 *   node-pty, SQLite, Drizzle) without modification.
 */

import { app, BrowserWindow, shell } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createConnection } from 'node:net';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.name = 'CommandDeck';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEV = !app.isPackaged;
const APP_HOST = '127.0.0.1';
const APP_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const APP_URL = `http://${APP_HOST}:${APP_PORT}`;

// Window state persistence file
const STATE_FILE = join(app.getPath('userData'), 'window-state.json');

type WindowState = {
  x?: number;
  y?: number;
  width: number;
  height: number;
};

// ─── Window state persistence ─────────────────────────────────────────────────

function loadWindowState(): WindowState {
  const defaults: WindowState = { width: 1280, height: 800 };

  try {
    if (existsSync(STATE_FILE)) {
      const raw = readFileSync(STATE_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Partial<WindowState>;
      return {
        x: parsed.x,
        y: parsed.y,
        width: parsed.width ?? defaults.width,
        height: parsed.height ?? defaults.height,
      };
    }
  } catch {
    // Ignore malformed state files; fall back to defaults.
  }

  return defaults;
}

function saveWindowState(win: BrowserWindow): void {
  try {
    const { x, y, width, height } = win.getBounds();
    const stateDir = join(STATE_FILE, '..');
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify({ x, y, width, height }), 'utf8');
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
 * separate terminal), this function reuses the existing server and skips
 * spawning a new one.
 */
function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const projectRoot = DEV
      ? join(__dirname, '..') // .electron/main.js → project root
      : join(__dirname, '..', '..'); // packaged dist → project root

    let command: string;
    let args: string[];

    if (DEV) {
      // Development: run via tsx (same as `npm run dev`)
      const tsxBin = join(projectRoot, 'node_modules', '.bin', 'tsx');
      command = tsxBin;
      args = ['watch', join(projectRoot, 'server.ts')];
    } else {
      // Production: run compiled server
      command = process.execPath; // Use the bundled Node runtime
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

    /** Marks the promise as resolved and clears the timeout. */
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

      // The server prints this line when ready (see server.ts)
      if (text.includes('CommandDeck is ready at')) {
        markReady();
        return;
      }

      // Next.js reports an existing dev server: probe the port and reuse it.
      if (text.includes('Another next dev server is already running')) {
        console.log('[Electron] Existing server detected — reusing it.');
        // Give the existing server a moment, then probe
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

      // tsx also emits the ready message to stderr in some situations
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
        // The process exited before reporting ready — check if an existing
        // server is actually running (handles "another server running" → exit)
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
    show: false, // Show only after content is ready to avoid flash
    backgroundColor: '#0a0a0f', // Match the app's dark background
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  // Open external links in the system browser, not in Electron
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
