export type CommandStartedPayload = {
  commandId: string;
  command: string;
  cwd: string;
  startedAt: number;
};

export type CommandCompletedPayload = CommandStartedPayload & {
  endedAt: number;
  durationMs: number;
  exitCode: number;
  completionReason: 'shell' | 'session-exit';
};

export type CommandHistoryEntry = CommandCompletedPayload & {
  createdAt: number;
};

export type CommandHistoryStatus = 'success' | 'failed' | 'interrupted';

export type CommandHistoryQuery = {
  searchTerm: string;
  statuses: CommandHistoryStatus[];
};

export type CommandLifecycleEvent =
  | { type: 'command.started'; payload: CommandStartedPayload }
  | { type: 'command.completed'; payload: CommandCompletedPayload };
