export const ZSH_COMMAND_INDICATOR = '❯';

export const ZSH_PROMPT_PRESENTATION_SCRIPT = String.raw`
__commanddeck_render_command_separator() {
  builtin printf '\n'
}

builtin setopt prompt_percent
PROMPT="%{$(__commanddeck_emit_prompt_start)%}%F{cyan}%~%f
%B%F{green}${ZSH_COMMAND_INDICATOR}%f%b %{$(__commanddeck_emit_prompt_end)%}"
PROMPT2='  '
RPROMPT=''
PROMPT_EOL_MARK=''
`;
