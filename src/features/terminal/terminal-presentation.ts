import type { ITerminalInitOnlyOptions, ITerminalOptions } from '@xterm/xterm';
import type { AppSettings } from '@/shared/types';

const TERMINAL_THEMES = {
  dark: {
    background: '#000000',
    foreground: '#f5f5f5',
    cursor: '#f5f5f5',
    cursorAccent: '#000000',
    selectionBackground: '#424242aa',
    selectionInactiveBackground: '#30303088',
    black: '#212121',
    red: '#ef8d98',
    green: '#f5f5f5',
    yellow: '#e0e0e0',
    blue: '#f5f5f5',
    magenta: '#e0e0e0',
    cyan: '#f5f5f5',
    white: '#f5f5f5',
    brightBlack: '#8e8e8e',
    brightRed: '#f5f5f5',
    brightGreen: '#f5f5f5',
    brightYellow: '#e0e0e0',
    brightBlue: '#f5f5f5',
    brightMagenta: '#e0e0e0',
    brightCyan: '#ffffff',
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
