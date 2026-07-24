import type { IDecoration, Terminal as XtermTerminal } from '@xterm/xterm';

export const COMPLETED_COMMAND_SEPARATOR_CLASS =
  'commanddeck-command-section-separator';

export type TerminalCommandSectionHost = Pick<
  XtermTerminal,
  'buffer' | 'registerDecoration' | 'registerMarker' | 'write'
>;

/**
 * Owns presentation-only anchors for the command lifecycle currently retained
 * by xterm. It never reads or writes terminal content.
 */
export class TerminalCommandSections {
  private activeCommandId: string | null = null;
  private readonly completedSections = new Map<string, IDecoration>();
  private generation = 0;
  private disposed = false;

  constructor(private readonly terminal: TerminalCommandSectionHost) {}

  commandStarted(commandId: string): void {
    if (!this.disposed) {
      this.activeCommandId = commandId;
    }
  }

  commandCompleted(commandId: string): void {
    if (this.disposed || this.activeCommandId !== commandId) {
      return;
    }

    this.activeCommandId = null;
    const generation = this.generation;

    // An empty write queues behind all PTY bytes flushed before the completion
    // event. The marker therefore lands at the real output boundary without
    // adding content to the terminal buffer.
    this.terminal.write('', () => {
      if (
        this.disposed ||
        generation !== this.generation ||
        this.terminal.buffer.active.type !== 'normal'
      ) {
        return;
      }

      this.registerCompletedCommandSeparator(commandId);
    });
  }

  reset(): void {
    this.generation += 1;
    this.activeCommandId = null;

    for (const decoration of this.completedSections.values()) {
      decoration.dispose();
    }

    this.completedSections.clear();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.reset();
    this.disposed = true;
  }

  private registerCompletedCommandSeparator(commandId: string): void {
    const marker = this.terminal.registerMarker();
    let decoration: IDecoration | undefined;

    try {
      decoration = this.terminal.registerDecoration({ marker });
    } catch {
      // The shell-owned blank line remains the compatibility fallback if the
      // optional xterm decoration API is unavailable.
      marker.dispose();
      return;
    }

    if (!decoration) {
      marker.dispose();
      return;
    }

    const registeredDecoration = decoration;
    this.completedSections.set(commandId, registeredDecoration);
    registeredDecoration.onDispose(() => {
      if (this.completedSections.get(commandId) === registeredDecoration) {
        this.completedSections.delete(commandId);
      }
    });
    registeredDecoration.onRender(applyCompletedCommandSeparatorPresentation);
  }
}

function applyCompletedCommandSeparatorPresentation(element: HTMLElement) {
  element.classList.add(COMPLETED_COMMAND_SEPARATOR_CLASS);
  element.setAttribute('aria-hidden', 'true');
}
