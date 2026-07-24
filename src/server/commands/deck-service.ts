import { randomUUID } from 'node:crypto';

import type {
  CommandDeckItem,
  CommandDeckItemUpdate,
} from '../../shared/types/deck.js';
import type { CommandDeckRepository } from '../db/repositories/command-deck-repository.js';
import type { CommandHistoryRepository } from '../db/repositories/command-history-repository.js';

export type AddHistoryEntryToDeckResult =
  | { outcome: 'created'; item: CommandDeckItem }
  | { outcome: 'exists'; item: CommandDeckItem }
  | { outcome: 'history-not-found' };

export class CommandDeckService {
  constructor(
    private readonly repository: CommandDeckRepository,
    private readonly historyRepository: CommandHistoryRepository,
    private readonly createId: () => string = randomUUID,
    private readonly clock: () => number = Date.now,
  ) {}

  listDeckItems(): CommandDeckItem[] {
    return this.repository.list();
  }

  addHistoryEntry(historyId: string): AddHistoryEntryToDeckResult {
    const existing = this.repository.findBySourceHistoryId(historyId);

    if (existing) {
      return { outcome: 'exists', item: existing };
    }

    const historyEntry = this.historyRepository.findById(historyId);

    if (!historyEntry) {
      return { outcome: 'history-not-found' };
    }

    const item = this.repository.create({
      deckItemId: this.createId(),
      definitionId: this.createId(),
      sourceHistoryId: historyId,
      displayName: deriveDisplayName(historyEntry.command),
      command: historyEntry.command,
      createdAt: this.clock(),
    });

    return { outcome: 'created', item };
  }

  updateDeckItem(
    deckItemId: string,
    update: CommandDeckItemUpdate,
  ): CommandDeckItem | null {
    return this.repository.update(deckItemId, update, this.clock());
  }

  removeDeckItem(deckItemId: string): boolean {
    return this.repository.delete(deckItemId);
  }
}

function deriveDisplayName(command: string): string {
  const firstLine = command.trim().split(/\r?\n/, 1)[0] ?? command.trim();
  return firstLine.length <= 80 ? firstLine : `${firstLine.slice(0, 79)}…`;
}
