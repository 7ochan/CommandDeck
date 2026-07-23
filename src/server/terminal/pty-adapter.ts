import { existsSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { basename, isAbsolute } from 'node:path';
import * as pty from 'node-pty';

import {
  createShellLaunchProfile,
  type ShellIntegrationConfiguration,
} from '../shell-integration/shell-profiles.js';

export const DEFAULT_TERMINAL_COLUMNS = 80;
export const DEFAULT_TERMINAL_ROWS = 24;

export type PtyLaunch = {
  process: pty.IPty;
  shell: string;
  cwd: string;
  cols: number;
  rows: number;
  integration: ShellIntegrationConfiguration | null;
  dispose: () => void;
};

export class PtyAdapter {
  spawnDefaultShell(
    cols = DEFAULT_TERMINAL_COLUMNS,
    rows = DEFAULT_TERMINAL_ROWS,
  ): PtyLaunch {
    const shell = resolveDefaultShell();
    const cwd = resolveStartingDirectory();
    const shellProfile = createShellLaunchProfile(shell);
    const environment: Record<string, string | undefined> = {
      ...process.env,
      ...shellProfile.environment,
      COLORTERM: 'truecolor',
      TERM: 'xterm-256color',
      TERM_PROGRAM: 'CommandDeck',
      TERM_PROGRAM_VERSION: '0.1.0',
    };

    let terminalProcess: pty.IPty;

    try {
      terminalProcess = pty.spawn(shell, shellArguments(shell), {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env: environment,
        encoding: 'utf8',
      });
    } catch (error) {
      shellProfile.dispose();
      throw error;
    }

    return {
      process: terminalProcess,
      shell,
      cwd,
      cols,
      rows,
      integration: shellProfile.integration,
      dispose: shellProfile.dispose,
    };
  }
}

function resolveDefaultShell(): string {
  if (platform() === 'win32') {
    return process.env.COMSPEC ?? 'powershell.exe';
  }

  const configuredShell = process.env.SHELL;

  if (
    configuredShell &&
    isAbsolute(configuredShell) &&
    existsSync(configuredShell)
  ) {
    return configuredShell;
  }

  return platform() === 'darwin' ? '/bin/zsh' : '/bin/bash';
}

function resolveStartingDirectory(): string {
  const home = homedir();
  return existsSync(home) ? home : process.cwd();
}

function shellArguments(shell: string): string[] {
  if (platform() !== 'win32') {
    return ['-l'];
  }

  return basename(shell).toLowerCase().includes('powershell')
    ? ['-NoLogo']
    : [];
}
