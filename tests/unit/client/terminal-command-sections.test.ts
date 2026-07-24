import type { IDecoration, IMarker } from '@xterm/xterm';
import { describe, expect, it, vi } from 'vitest';

import {
  COMPLETED_COMMAND_SEPARATOR_CLASS,
  TerminalCommandSections,
  type TerminalCommandSectionHost,
} from '../../../src/features/terminal/terminal-command-sections.js';

describe('terminal command sections', () => {
  it('anchors a text-free separator after the matching command output parses', () => {
    const fixture = createTerminalFixture();
    const sections = new TerminalCommandSections(fixture.terminal);

    sections.commandStarted('command-1');
    sections.commandCompleted('command-1');

    expect(fixture.terminal.write).toHaveBeenCalledWith(
      '',
      expect.any(Function),
    );
    expect(fixture.terminal.registerMarker).not.toHaveBeenCalled();

    fixture.flushWrites();

    expect(fixture.terminal.registerMarker).toHaveBeenCalledOnce();
    expect(fixture.terminal.registerDecoration).toHaveBeenCalledWith({
      marker: fixture.marker,
    });

    const addClass = vi.fn();
    const setAttribute = vi.fn();
    fixture.render({
      classList: { add: addClass },
      setAttribute,
    } as unknown as HTMLElement);

    expect(addClass).toHaveBeenCalledWith(COMPLETED_COMMAND_SEPARATOR_CLASS);
    expect(setAttribute).toHaveBeenCalledWith('aria-hidden', 'true');
  });

  it('ignores unrelated completions and invalidates queued anchors on reset', () => {
    const fixture = createTerminalFixture();
    const sections = new TerminalCommandSections(fixture.terminal);

    sections.commandStarted('command-1');
    sections.commandCompleted('command-2');
    expect(fixture.terminal.write).not.toHaveBeenCalled();

    sections.commandCompleted('command-1');
    sections.reset();
    fixture.flushWrites();

    expect(fixture.terminal.registerMarker).not.toHaveBeenCalled();
  });

  it('does not create normal-buffer presentation while an alternate buffer is active', () => {
    const fixture = createTerminalFixture('alternate');
    const sections = new TerminalCommandSections(fixture.terminal);

    sections.commandStarted('interactive-command');
    sections.commandCompleted('interactive-command');
    fixture.flushWrites();

    expect(fixture.terminal.registerMarker).not.toHaveBeenCalled();
  });

  it('disposes retained section presentation on reset', () => {
    const fixture = createTerminalFixture();
    const sections = new TerminalCommandSections(fixture.terminal);

    sections.commandStarted('command-1');
    sections.commandCompleted('command-1');
    fixture.flushWrites();
    sections.reset();

    expect(fixture.decoration.dispose).toHaveBeenCalledOnce();
  });

  it('keeps native shell spacing when decoration registration is unavailable', () => {
    const fixture = createTerminalFixture();
    const sections = new TerminalCommandSections(fixture.terminal);
    fixture.terminal.registerDecoration.mockImplementationOnce(() => {
      throw new Error('Proposed API unavailable');
    });

    sections.commandStarted('command-1');
    sections.commandCompleted('command-1');

    expect(() => fixture.flushWrites()).not.toThrow();
    expect(fixture.marker.dispose).toHaveBeenCalledOnce();
  });
});

function createTerminalFixture(bufferType: 'normal' | 'alternate' = 'normal') {
  const writeCallbacks: Array<() => void> = [];
  const renderListeners: Array<(element: HTMLElement) => void> = [];
  const disposeListeners: Array<() => void> = [];
  const marker = {
    dispose: vi.fn(),
  } as unknown as IMarker;
  const decoration = {
    dispose: vi.fn(() => {
      for (const listener of disposeListeners) {
        listener();
      }
    }),
    onDispose: vi.fn((listener: () => void) => {
      disposeListeners.push(listener);
      return { dispose: vi.fn() };
    }),
    onRender: vi.fn((listener: (element: HTMLElement) => void) => {
      renderListeners.push(listener);
      return { dispose: vi.fn() };
    }),
  } as unknown as IDecoration;
  const terminal = {
    buffer: { active: { type: bufferType } },
    registerDecoration: vi.fn(() => decoration),
    registerMarker: vi.fn(() => marker),
    write: vi.fn((_data: string, callback?: () => void) => {
      if (callback) {
        writeCallbacks.push(callback);
      }
    }),
  } as unknown as TerminalCommandSectionHost & {
    registerDecoration: ReturnType<typeof vi.fn>;
    registerMarker: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
  };

  return {
    decoration,
    marker,
    terminal,
    flushWrites: () => {
      for (const callback of writeCallbacks.splice(0)) {
        callback();
      }
    },
    render: (element: HTMLElement) => {
      for (const listener of renderListeners) {
        listener(element);
      }
    },
  };
}
