import { describe, expect, it } from 'vitest';

import { ZSH_INTEGRATION_SCRIPT } from '../../../src/server/shell-integration/scripts/zsh-integration.js';
import {
  ZSH_COMMAND_INDICATOR,
  ZSH_PROMPT_PRESENTATION_SCRIPT,
} from '../../../src/server/shell-integration/scripts/zsh-prompt.js';

describe('zsh prompt presentation', () => {
  it('renders only abbreviated cwd and the CommandDeck indicator', () => {
    expect(ZSH_COMMAND_INDICATOR).toBe('❯');
    expect(ZSH_PROMPT_PRESENTATION_SCRIPT).toContain('%B%F{cyan}%~%f%b');
    expect(ZSH_PROMPT_PRESENTATION_SCRIPT).toContain(
      `%B%F{green}${ZSH_COMMAND_INDICATOR}%f%b `,
    );
    expect(ZSH_PROMPT_PRESENTATION_SCRIPT).toContain("RPROMPT=''");
    expect(ZSH_PROMPT_PRESENTATION_SCRIPT).toContain("PROMPT_EOL_MARK=''");
    expect(ZSH_PROMPT_PRESENTATION_SCRIPT).not.toMatch(/%[nmM]/);
  });

  it('adds native spacing only after a detected command completion', () => {
    expect(ZSH_INTEGRATION_SCRIPT).toContain('command_completed=1');
    expect(ZSH_INTEGRATION_SCRIPT).toContain(
      'if (( command_completed )); then\n    __commanddeck_render_command_separator',
    );
  });
});
