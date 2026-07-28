import { describe, expect, it } from 'vitest';

import {
  getTerminalPresentationOptions,
  TERMINAL_PRESENTATION_OPTIONS,
} from '../../../src/features/terminal/terminal-presentation.js';

describe('terminal presentation options', () => {
  it('keeps readable, accessible xterm-native rendering defaults', () => {
    expect(TERMINAL_PRESENTATION_OPTIONS.allowProposedApi).toBe(true);
    expect(TERMINAL_PRESENTATION_OPTIONS.cursorStyle).toBe('bar');
    expect(TERMINAL_PRESENTATION_OPTIONS.cursorWidth).toBe(2);
    expect(TERMINAL_PRESENTATION_OPTIONS.lineHeight).toBeGreaterThan(1.2);
    expect(TERMINAL_PRESENTATION_OPTIONS.minimumContrastRatio).toBe(4.5);
    expect(TERMINAL_PRESENTATION_OPTIONS.screenReaderMode).toBe(true);
    expect(TERMINAL_PRESENTATION_OPTIONS.scrollback).toBe(5_000);
  });

  it('maps live terminal preferences without changing foundation options', () => {
    const options = getTerminalPresentationOptions(
      {
        fontSize: 18,
        cursorStyle: 'underline',
        cursorBlink: false,
        scrollbackSize: 20_000,
        dirColor: 'cyan',
      },
      'light',
    );

    expect(options).toMatchObject({
      fontSize: 18,
      cursorStyle: 'underline',
      cursorBlink: false,
      scrollback: 20_000,
      screenReaderMode: true,
      theme: { background: '#ffffff' },
    });
  });
});
