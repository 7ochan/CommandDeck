import { existsSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { basename, isAbsolute } from 'node:path';
import * as pty from 'node-pty';

export const DEFAULT_TERMINAL_COLUMNS = 80;
export const DEFAULT_TERMINAL_ROWS = 24;

export type PtyLaunch = {
  process: pty.IPty;
  shell: string;
  cwd: string;
  cols: number;
  rows: number;
};

export class PtyAdapter {
  spawnDefaultShell(
    cols = DEFAULT_TERMINAL_COLUMNS,
    rows = DEFAULT_TERMINAL_ROWS,
  ): PtyLaunch {
    const shell = resolveDefaultShell();
    const cwd = resolveStartingDirectory();
    const environment: Record<string, string | undefined> = {
      ...process.env,
      COLORTERM: 'truecolor',
      TERM: 'xterm-256color',
      TERM_PROGRAM: 'CommandDeck',
      TERM_PROGRAM_VERSION: '0.1.0',
    };

    const terminalProcess = pty.spawn(shell, shellArguments(shell), {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: environment,
      encoding: 'utf8',
    });

    return {
      process: terminalProcess,
      shell,
      cwd,
      cols,
      rows,
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
