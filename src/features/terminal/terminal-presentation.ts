import type { ITerminalInitOnlyOptions, ITerminalOptions } from '@xterm/xterm';
import type { AppSettings, DirColor } from '@/shared/types';

export const DIR_COLOR_PALETTES: Record<
  DirColor,
  {
    name: string;
    dark: { main: string; bright: string };
    light: { main: string; bright: string };
  }
> = {
  cyan: {
    name: 'Electric Cyan',
    dark: { main: '#38bdf8', bright: '#7dd3fc' },
    light: { main: '#0284c7', bright: '#0369a1' },
  },
  emerald: {
    name: 'Emerald Mint',
    dark: { main: '#34d399', bright: '#6ee7b7' },
    light: { main: '#059669', bright: '#047857' },
  },
  purple: {
    name: 'Neon Violet',
    dark: { main: '#c084fc', bright: '#e879f9' },
    light: { main: '#7c3aed', bright: '#6d28d9' },
  },
  amber: {
    name: 'Amber Gold',
    dark: { main: '#fbbf24', bright: '#fde047' },
    light: { main: '#d97706', bright: '#b45309' },
  },
  coral: {
    name: 'Coral Pink',
    dark: { main: '#f87171', bright: '#fb7185' },
    light: { main: '#dc2626', bright: '#b91c1c' },
  },
  blue: {
    name: 'Royal Blue',
    dark: { main: '#60a5fa', bright: '#93c5fd' },
    light: { main: '#2563eb', bright: '#1d4ed8' },
  },
  magenta: {
    name: 'Neon Magenta',
    dark: { main: '#f0abfc', bright: '#f472b6' },
    light: { main: '#c026d3', bright: '#a21caf' },
  },
};

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
    green: '#a7f3d0',
    yellow: '#fef08a',
    blue: '#38bdf8',
    magenta: '#f0abfc',
    cyan: '#38bdf8',
    white: '#f5f5f5',
    brightBlack: '#8e8e8e',
    brightRed: '#fca5a5',
    brightGreen: '#6ee7b7',
    brightYellow: '#fde047',
    brightBlue: '#7dd3fc',
    brightMagenta: '#f472b6',
    brightCyan: '#7dd3fc',
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
    green: '#059669',
    yellow: '#d97706',
    blue: '#0284c7',
    magenta: '#c026d3',
    cyan: '#0284c7',
    white: '#e5e9ed',
    brightBlack: '#65717d',
    brightRed: '#dc2626',
    brightGreen: '#047857',
    brightYellow: '#b45309',
    brightBlue: '#0369a1',
    brightMagenta: '#a21caf',
    brightCyan: '#0369a1',
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
  const dirColor = settings.dirColor ?? 'cyan';
  const palette =
    DIR_COLOR_PALETTES[dirColor]?.[theme] ?? DIR_COLOR_PALETTES.cyan[theme];
  const baseTheme = TERMINAL_THEMES[theme];

  return {
    ...BASE_TERMINAL_PRESENTATION_OPTIONS,
    cursorBlink: settings.cursorBlink,
    cursorStyle: settings.cursorStyle,
    fontSize: settings.fontSize,
    scrollback: settings.scrollbackSize,
    theme: {
      ...baseTheme,
      blue: palette.main,
      brightBlue: palette.bright,
      cyan: palette.main,
      brightCyan: palette.bright,
    },
  };
}

export const TERMINAL_PRESENTATION_OPTIONS = getTerminalPresentationOptions(
  {
    fontSize: 14,
    cursorStyle: 'bar',
    cursorBlink: true,
    scrollbackSize: 5_000,
    dirColor: 'cyan',
  },
  'dark',
);
