export type CommandStartedPayload = {
  commandId: string;
  command: string;
  cwd: string;
  startedAt: number;
};

export type CommandCard = CommandStartedPayload & {
  finishedAt: number;
  durationMs: number;
  exitCode: number;
};

export type CommandCompletedPayload = CommandCard & {
  completionReason: 'shell' | 'session-exit';
};

export type CommandLifecycleEvent =
  | { type: 'command.started'; payload: CommandStartedPayload }
  | { type: 'command.completed'; payload: CommandCompletedPayload };
