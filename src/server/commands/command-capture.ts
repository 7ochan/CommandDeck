import { randomUUID } from 'node:crypto';

import type { ShellMarker } from '../shell-integration/parsers/osc-parser.js';
import type {
  CommandCompletedPayload,
  CommandLifecycleEvent,
  CommandStartedPayload,
} from '../../shared/types/command.js';

type CommandListener = (event: CommandLifecycleEvent) => void;

export class CommandCapture {
  private readonly listeners = new Set<CommandListener>();
  private pendingCommand: string | null = null;
  private activeCommand: CommandStartedPayload | null = null;
  private cwd: string;

  constructor(
    initialCwd: string,
    private readonly workspaceId: string,
    private readonly clock: () => number = Date.now,
  ) {
    this.cwd = initialCwd;
  }

  onEvent(listener: CommandListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  accept(marker: ShellMarker): void {
    if (marker.type === 'cwd') {
      this.cwd = marker.cwd;
      return;
    }

    if (marker.type === 'command.line') {
      this.pendingCommand = marker.command.trim().length
        ? marker.command
        : null;
      return;
    }

    if (marker.type === 'command.start') {
      this.startPendingCommand();
      return;
    }

    if (marker.type === 'command.end') {
      this.completeActiveCommand(marker.exitCode, 'shell');
    }
  }

  handleSessionExit(exitCode: number): void {
    this.completeActiveCommand(exitCode, 'session-exit');
  }

  private startPendingCommand(): void {
    if (!this.pendingCommand || this.activeCommand) {
      this.pendingCommand = null;
      return;
    }

    this.activeCommand = {
      commandId: randomUUID(),
      workspaceId: this.workspaceId,
      command: this.pendingCommand,
      cwd: this.cwd,
      startedAt: this.clock(),
    };
    this.pendingCommand = null;
    this.emit({ type: 'command.started', payload: this.activeCommand });
  }

  private completeActiveCommand(
    exitCode: number,
    completionReason: CommandCompletedPayload['completionReason'],
  ): void {
    if (!this.activeCommand) {
      return;
    }

    const endedAt = this.clock();
    const payload: CommandCompletedPayload = {
      ...this.activeCommand,
      endedAt,
      durationMs: Math.max(0, endedAt - this.activeCommand.startedAt),
      exitCode,
      completionReason,
    };
    this.activeCommand = null;
    this.emit({ type: 'command.completed', payload });
  }

  private emit(event: CommandLifecycleEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
