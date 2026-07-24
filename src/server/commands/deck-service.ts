import { randomUUID } from 'node:crypto';

import { validateCommandTemplate } from '../../shared/command-template/index.js';
import type {
  CommandDeckItem,
  CommandDeckItemUpdate,
} from '../../shared/types/deck.js';
import type { CommandDeckRepository } from '../db/repositories/command-deck-repository.js';
import type { CommandHistoryRepository } from '../db/repositories/command-history-repository.js';

export type AddHistoryEntryToDeckResult =
  | { outcome: 'created'; item: CommandDeckItem }
  | { outcome: 'exists'; item: CommandDeckItem }
  | { outcome: 'invalid-template'; message: string }
  | { outcome: 'history-not-found' };

export type UpdateCommandDeckItemResult =
  | { outcome: 'updated'; item: CommandDeckItem }
  | { outcome: 'invalid-template'; message: string }
  | { outcome: 'not-found' };

export class CommandDeckService {
  constructor(
    private readonly repository: CommandDeckRepository,
    private readonly historyRepository: CommandHistoryRepository,
    private readonly createId: () => string = randomUUID,
    private readonly clock: () => number = Date.now,
  ) {}

  listDeckItems(workspaceId: string): CommandDeckItem[] {
    return this.repository.list(workspaceId);
  }

  addHistoryEntry(
    workspaceId: string,
    historyId: string,
  ): AddHistoryEntryToDeckResult {
    const existing = this.repository.findBySourceHistoryId(
      workspaceId,
      historyId,
    );

    if (existing) {
      return { outcome: 'exists', item: existing };
    }

    const historyEntry = this.historyRepository.findById(
      workspaceId,
      historyId,
    );

    if (!historyEntry) {
      return { outcome: 'history-not-found' };
    }

    const templateValidation = validateCommandTemplate(historyEntry.command);

    if (!templateValidation.isValid) {
      return {
        outcome: 'invalid-template',
        message:
          templateValidation.errors[0]?.message ??
          'This command contains malformed placeholder syntax.',
      };
    }

    const item = this.repository.create({
      deckItemId: this.createId(),
      definitionId: this.createId(),
      workspaceId,
      sourceHistoryId: historyId,
      displayName: deriveDisplayName(historyEntry.command),
      command: historyEntry.command,
      createdAt: this.clock(),
    });

    return { outcome: 'created', item };
  }

  updateDeckItem(
    workspaceId: string,
    deckItemId: string,
    update: CommandDeckItemUpdate,
  ): UpdateCommandDeckItemResult {
    if (update.command !== undefined) {
      const templateValidation = validateCommandTemplate(update.command);

      if (!templateValidation.isValid) {
        return {
          outcome: 'invalid-template',
          message:
            templateValidation.errors[0]?.message ??
            'This command contains malformed placeholder syntax.',
        };
      }
    }

    const item = this.repository.update(
      workspaceId,
      deckItemId,
      update,
      this.clock(),
    );
    return item ? { outcome: 'updated', item } : { outcome: 'not-found' };
  }

  removeDeckItem(workspaceId: string, deckItemId: string): boolean {
    return this.repository.delete(workspaceId, deckItemId);
  }
}

function deriveDisplayName(command: string): string {
  const firstLine = command.trim().split(/\r?\n/, 1)[0] ?? command.trim();
  return firstLine.length <= 80 ? firstLine : `${firstLine.slice(0, 79)}…`;
}
