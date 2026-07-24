import type {
  CommandHistoryEntry,
  CommandHistoryQuery,
  CommandLifecycleEvent,
} from '../../shared/types/command.js';
import type { CommandHistoryRepository } from '../db/repositories/command-history-repository.js';
import type { CommandEventBus } from './command-events.js';

type PersistenceErrorHandler = (error: unknown) => void;

export class CommandHistoryService {
  private readonly unsubscribe: () => void;

  constructor(
    private readonly repository: CommandHistoryRepository,
    commandEvents: CommandEventBus,
    private readonly clock: () => number = Date.now,
    private readonly onPersistenceError: PersistenceErrorHandler = () => {
      console.error('Unable to persist completed command to History.');
    },
  ) {
    this.unsubscribe = commandEvents.subscribe((event) => {
      this.persistCompletedCommand(event);
    });
  }

  listHistory(
    workspaceId: string,
    query?: CommandHistoryQuery,
  ): CommandHistoryEntry[] {
    return this.repository.listNewestFirst(workspaceId, query);
  }

  close(): void {
    this.unsubscribe();
  }

  private persistCompletedCommand(event: CommandLifecycleEvent): void {
    if (event.type !== 'command.completed') {
      return;
    }

    try {
      this.repository.insert({
        ...event.payload,
        createdAt: this.clock(),
      });
    } catch (error) {
      this.onPersistenceError(error);
    }
  }
}
