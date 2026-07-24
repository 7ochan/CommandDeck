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

export type CommandCard = CommandCompletedPayload & {
  createdAt: number;
};

export type CommandCardStatus = 'success' | 'failed' | 'interrupted';

export type CommandCardQuery = {
  searchTerm: string;
  statuses: CommandCardStatus[];
};

export type CommandLifecycleEvent =
  | { type: 'command.started'; payload: CommandStartedPayload }
  | { type: 'command.completed'; payload: CommandCompletedPayload };
