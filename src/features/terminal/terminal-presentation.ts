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
    background: '#ffffff',
    foreground: '#151b22',
    cursor: '#151b22',
    cursorAccent: '#ffffff',
    selectionBackground: '#c4cbd288',
    selectionInactiveBackground: '#dcdfe366',
    black: '#151b22',
    red: '#b53f4c',
    green: '#151b22',
    yellow: '#65717d',
    blue: '#151b22',
    magenta: '#3b4652',
    cyan: '#151b22',
    white: '#e5e9ed',
    brightBlack: '#65717d',
    brightRed: '#151b22',
    brightGreen: '#151b22',
    brightYellow: '#65717d',
    brightBlue: '#151b22',
    brightMagenta: '#3b4652',
    brightCyan: '#000000',
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
