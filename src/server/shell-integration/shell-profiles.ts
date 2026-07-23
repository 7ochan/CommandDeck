import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { ZSH_INTEGRATION_SCRIPT } from './scripts/zsh-integration.js';

export type ShellIntegrationConfiguration = {
  shell: 'zsh';
  nonce: string;
};

export type ShellLaunchProfile = {
  environment: Record<string, string>;
  integration: ShellIntegrationConfiguration | null;
  dispose: () => void;
};

export function createShellLaunchProfile(shell: string): ShellLaunchProfile {
  if (basename(shell) !== 'zsh') {
    return {
      environment: {},
      integration: null,
      dispose: () => undefined,
    };
  }

  return createZshLaunchProfile();
}

function createZshLaunchProfile(): ShellLaunchProfile {
  const nonce = randomBytes(24).toString('base64url');
  const injectionDirectory = mkdtempSync(join(tmpdir(), 'commanddeck-zsh-'));
  const userZdotdir = process.env.ZDOTDIR || homedir();
  const integrationPath = join(
    injectionDirectory,
    'commanddeck-integration.zsh',
  );

  writeFileSync(integrationPath, ZSH_INTEGRATION_SCRIPT, { mode: 0o600 });
  writeFileSync(
    join(injectionDirectory, '.zshenv'),
    sourceUserStartupFile(userZdotdir, '.zshenv', true),
    { mode: 0o600 },
  );
  writeFileSync(
    join(injectionDirectory, '.zprofile'),
    sourceUserStartupFile(userZdotdir, '.zprofile', true),
    { mode: 0o600 },
  );
  writeFileSync(
    join(injectionDirectory, '.zshrc'),
    `${sourceUserStartupFile(userZdotdir, '.zshrc', false)}\n` +
      `builtin source ${shellQuote(integrationPath)}\n`,
    { mode: 0o600 },
  );
  writeFileSync(
    join(injectionDirectory, '.zlogin'),
    sourceUserStartupFile(userZdotdir, '.zlogin', false),
    { mode: 0o600 },
  );

  return {
    environment: {
      COMMANDDECK_SHELL_NONCE: nonce,
      COMMANDDECK_USER_ZDOTDIR: userZdotdir,
      ZDOTDIR: injectionDirectory,
    },
    integration: { shell: 'zsh', nonce },
    dispose: () => {
      rmSync(injectionDirectory, { recursive: true, force: true });
    },
  };
}

function sourceUserStartupFile(
  userZdotdir: string,
  filename: string,
  restoreInjectionDirectory: boolean,
): string {
  const userFile = join(userZdotdir, filename);

  return [
    'typeset -g __commanddeck_injection_zdotdir="$ZDOTDIR"',
    `ZDOTDIR=${shellQuote(userZdotdir)}`,
    `if [[ -r ${shellQuote(userFile)} ]]; then`,
    `  builtin source ${shellQuote(userFile)}`,
    'fi',
    ...(restoreInjectionDirectory
      ? ['ZDOTDIR="$__commanddeck_injection_zdotdir"']
      : []),
    '',
  ].join('\n');
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
