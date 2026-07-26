import type { ITerminalInitOnlyOptions, ITerminalOptions } from '@xterm/xterm';
import type { AppSettings } from '@/shared/types';

const TERMINAL_THEMES = {
  dark: {
    background: '#000000',
    foreground: '#f5f5f5',
    cursor: '#73d9ad',
    cursorAccent: '#000000',
    selectionBackground: '#424242aa',
    selectionInactiveBackground: '#30303088',
    black: '#212121',
    red: '#ef8d98',
    green: '#73d9ad',
    yellow: '#e8b96a',
    blue: '#77bdfb',
    magenta: '#c39be8',
    cyan: '#6ac8d7',
    white: '#f5f5f5',
    brightBlack: '#697580',
    brightRed: '#f6a9b1',
    brightGreen: '#9aebc7',
    brightYellow: '#f0cf91',
    brightBlue: '#9dd0ff',
    brightMagenta: '#d8b8f2',
    brightCyan: '#94dce6',
    brightWhite: '#ffffff',
  },
  light: {
    background: '#f7f8fa',
    foreground: '#25313c',
    cursor: '#167a58',
    cursorAccent: '#f7f8fa',
    selectionBackground: '#b9dfd1aa',
    selectionInactiveBackground: '#d4e5df99',
    black: '#25313c',
    red: '#b53f4c',
    green: '#167a58',
    yellow: '#8a5d12',
    blue: '#246da3',
    magenta: '#765095',
    cyan: '#247582',
    white: '#e5e9ed',
    brightBlack: '#68737e',
    brightRed: '#ca5260',
    brightGreen: '#238a66',
    brightYellow: '#9b6c1f',
    brightBlue: '#337fb6',
    brightMagenta: '#8961a7',
    brightCyan: '#348692',
    brightWhite: '#ffffff',
  },
} as const;

const BASE_TERMINAL_PRESENTATION_OPTIONS = {
  allowProposedApi: true,
  cursorInactiveStyle: 'outline',
  cursorWidth: 2,
  drawBoldTextInBrightColors: true,
  fontFamily:
    "'SFMono-Regular', 'SF Mono', 'Cascadia Code', 'Liberation Mono', Menlo, monospace",
  fontWeight: '400',
  fontWeightBold: '600',
  letterSpacing: 0.2,
  lineHeight: 1.3,
  minimumContrastRatio: 4.5,
  screenReaderMode: true,
} as const;

export function getTerminalPresentationOptions(
  settings: AppSettings['terminal'],
  theme: 'dark' | 'light',
): ITerminalOptions & ITerminalInitOnlyOptions {
  return {
    ...BASE_TERMINAL_PRESENTATION_OPTIONS,
    cursorBlink: settings.cursorBlink,
    cursorStyle: settings.cursorStyle,
    fontSize: settings.fontSize,
    scrollback: settings.scrollbackSize,
    theme: TERMINAL_THEMES[theme],
  };
}

export const TERMINAL_PRESENTATION_OPTIONS = getTerminalPresentationOptions(
  {
    fontSize: 14,
    cursorStyle: 'bar',
    cursorBlink: true,
    scrollbackSize: 5_000,
  },
  'dark',
);
