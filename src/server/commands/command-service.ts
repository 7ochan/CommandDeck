import type {
  CommandCard,
  CommandCardQuery,
  CommandLifecycleEvent,
} from '../../shared/types/command.js';
import type { CommandCardRepository } from '../db/repositories/command-card-repository.js';
import type { CommandEventBus } from './command-events.js';

type PersistenceErrorHandler = (error: unknown) => void;

export class CommandService {
  private readonly unsubscribe: () => void;

  constructor(
    private readonly repository: CommandCardRepository,
    commandEvents: CommandEventBus,
    private readonly clock: () => number = Date.now,
    private readonly onPersistenceError: PersistenceErrorHandler = () => {
      console.error('Unable to persist completed command.');
    },
  ) {
    this.unsubscribe = commandEvents.subscribe((event) => {
      this.persistCompletedCommand(event);
    });
  }

  listCommandCards(query?: CommandCardQuery): CommandCard[] {
    return this.repository.listNewestFirst(query);
  }

  deleteCommandCard(commandId: string): boolean {
    return this.repository.deleteById(commandId);
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
