import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IDisposable, IPty } from 'node-pty';
import { afterEach, describe, expect, it } from 'vitest';

import {
  PtyAdapter,
  resolveStartingDirectory,
  type PtyLaunch,
  type PtyLaunchConfiguration,
} from '../../../src/server/terminal/pty-adapter.js';
import { TerminalSessionManager } from '../../../src/server/terminal/terminal-session-manager.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('Workspace Terminal State', () => {
  it('accepts only existing directories as PTY starting directories', () => {
    const directory = createTemporaryDirectory();
    const file = join(directory, 'not-a-directory');
    writeFileSync(file, 'file');

    expect(resolveStartingDirectory(directory)).toBe(directory);
    expect(resolveStartingDirectory(file)).toBe(homedir());
    expect(resolveStartingDirectory('.')).toBe(homedir());
    expect(resolveStartingDirectory(join(directory, 'missing'))).toBe(
      homedir(),
    );
  });

  it('loads launch state for the selected Workspace and persists cwd markers by current assignment', () => {
    const ptyAdapter = new FakePtyAdapter();
    const updates: Array<{
      workspaceId: string;
      update: { cwd?: string };
    }> = [];
    const terminalState = {
      getLaunchConfiguration: (workspaceId: string) => ({
        cwd: `/saved/${workspaceId}`,
      }),
      updateState: (workspaceId: string, update: { cwd?: string }) => {
        updates.push({ workspaceId, update });
        return true;
      },
    };
    const manager = new TerminalSessionManager(
      ptyAdapter,
      undefined,
      'default-workspace',
      terminalState,
    );
    const session = manager.create('workspace-one');

    expect(ptyAdapter.lastConfiguration).toEqual({
      cwd: '/saved/workspace-one',
    });
    ptyAdapter.process.emitCwd('/reported/one');
    session.setWorkspace('workspace-two');
    ptyAdapter.process.emitCwd('/reported/two');

    expect(updates).toEqual([
      {
        workspaceId: 'workspace-one',
        update: { cwd: '/reported/one' },
      },
      {
        workspaceId: 'workspace-two',
        update: { cwd: '/reported/two' },
      },
    ]);
    manager.closeAll();
  });
});

class FakePtyAdapter extends PtyAdapter {
  readonly process = new FakePty();
  lastConfiguration: PtyLaunchConfiguration | null = null;

  override spawnDefaultShell(
    configuration: PtyLaunchConfiguration = {},
    cols = 80,
    rows = 24,
  ): PtyLaunch {
    this.lastConfiguration = configuration;
    this.process.cols = cols;
    this.process.rows = rows;

    return {
      process: this.process as unknown as IPty,
      shell: '/bin/zsh',
      cwd: configuration.cwd ?? homedir(),
      cols,
      rows,
      integration: { shell: 'zsh', nonce: 'test-nonce' },
      dispose: () => undefined,
    };
  }
}

class FakePty {
  cols = 80;
  rows = 24;
  private readonly dataListeners = new Set<(data: string) => void>();
  private readonly exitListeners = new Set<
    (event: { exitCode: number; signal?: number }) => void
  >();

  onData(listener: (data: string) => void): IDisposable {
    this.dataListeners.add(listener);
    return { dispose: () => this.dataListeners.delete(listener) };
  }

  onExit(
    listener: (event: { exitCode: number; signal?: number }) => void,
  ): IDisposable {
    this.exitListeners.add(listener);
    return { dispose: () => this.exitListeners.delete(listener) };
  }

  emitCwd(cwd: string): void {
    const marker = `\u001b]633;P;Cwd=${cwd};test-nonce\u0007`;

    for (const listener of this.dataListeners) {
      listener(marker);
    }
  }

  write(): void {}

  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
  }

  kill(): void {
    for (const listener of this.exitListeners) {
      listener({ exitCode: 0 });
    }
  }
}

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'commanddeck-cwd-test-'));
  temporaryDirectories.push(directory);
  return directory;
}
