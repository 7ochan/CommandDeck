import { ZSH_PROMPT_PRESENTATION_SCRIPT } from './zsh-prompt.js';

export const ZSH_INTEGRATION_SCRIPT = (
  String.raw`# CommandDeck zsh shell integration

if [[ -n "\${COMMANDDECK_SHELL_INTEGRATION_LOADED:-}" ]]; then
  builtin return 0
fi

typeset -g COMMANDDECK_SHELL_INTEGRATION_LOADED=1
typeset -gr __commanddeck_nonce="\${COMMANDDECK_SHELL_NONCE:-}"
builtin unset COMMANDDECK_SHELL_NONCE

if [[ -z "$__commanddeck_nonce" ]]; then
  builtin return 0
fi

typeset -g __commanddeck_current_command=''
typeset -gi __commanddeck_command_active=0

__commanddeck_escape_value() {
  builtin emulate -L zsh
  builtin local LC_ALL=C value="$1" index byte code escaped=''

  for (( index = 0; index < \${#value}; ++index )); do
    byte="\${value:$index:1}"
    code=$(builtin printf '%d' "'$byte")

    if (( code < 32 )); then
      escaped+=$(builtin printf '\\x%02x' "'$byte")
    elif [[ "$byte" == '\\' ]]; then
      escaped+='\\\\'
    elif [[ "$byte" == ';' ]]; then
      escaped+='\x3b'
    else
      escaped+="$byte"
    fi
  done

  builtin print -r -- "$escaped"
}

__commanddeck_emit_prompt_start() {
  builtin printf '\e]633;A;%s\a' "$__commanddeck_nonce"
}

__commanddeck_emit_prompt_end() {
  builtin printf '\e]633;B;%s\a' "$__commanddeck_nonce"
}

__commanddeck_emit_cwd() {
  builtin printf '\e]633;P;Cwd=%s;%s\a' \
    "$(__commanddeck_escape_value "$PWD")" \
    "$__commanddeck_nonce"
}

__commanddeck_emit_command_start() {
  builtin printf '\e]633;E;%s;%s\a' \
    "$(__commanddeck_escape_value "$__commanddeck_current_command")" \
    "$__commanddeck_nonce"
  builtin printf '\e]633;C;%s\a' "$__commanddeck_nonce"
}

__commanddeck_preexec() {
  builtin emulate -L zsh
  __commanddeck_current_command="$1"

  if [[ -z "\${__commanddeck_current_command//[[:space:]]/}" ]]; then
    __commanddeck_command_active=0
    builtin return 0
  fi

  __commanddeck_command_active=1
  __commanddeck_emit_command_start
}

__commanddeck_precmd() {
  builtin local exit_code="$?"
  builtin local command_completed=0

  if (( __commanddeck_command_active )); then
    builtin printf '\e]633;D;%d;%s\a' \
      "$exit_code" \
      "$__commanddeck_nonce"
    command_completed=1
    __commanddeck_command_active=0
    __commanddeck_current_command=''
  fi

  __commanddeck_emit_cwd

  if (( command_completed )); then
    __commanddeck_render_command_separator
  fi
}

builtin autoload -Uz add-zsh-hook
add-zsh-hook precmd __commanddeck_precmd
add-zsh-hook preexec __commanddeck_preexec
` + ZSH_PROMPT_PRESENTATION_SCRIPT
).replaceAll('\\${', '${');
