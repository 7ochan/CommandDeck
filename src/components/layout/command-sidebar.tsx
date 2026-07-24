'use client';

import { CommandDeckSection } from '@/features/command-deck/components/command-deck-section';
import { CommandHistorySection } from '@/features/command-history/components/command-history-section';
import type {
  CommandDeckItem,
  CommandDeckItemUpdate,
  CommandHistoryEntry,
  CommandHistoryQuery,
  CommandHistoryStatus,
} from '@/shared/types';

type CommandSidebarProps = {
  deckItems: CommandDeckItem[];
  isDeckLoading: boolean;
  deckLoadError: string | null;
  historyEntries: CommandHistoryEntry[];
  selectedHistoryEntryId: string | null;
  historyQuery: CommandHistoryQuery;
  isHistoryLoading: boolean;
  isHistorySearching: boolean;
  historyLoadError: string | null;
  onHistorySearchTermChange: (searchTerm: string) => void;
  onToggleHistoryStatus: (status: CommandHistoryStatus) => void;
  onClearHistoryQuery: () => void;
  onSelectHistoryEntry: (commandId: string) => void;
  onClearHistorySelection: () => void;
  onAddHistoryToDeck: (historyId: string) => Promise<void>;
  onUpdateDeckItem: (
    deckItemId: string,
    update: CommandDeckItemUpdate,
  ) => Promise<void>;
  onRemoveDeckItem: (deckItemId: string) => Promise<void>;
  onRunCommand: (command: string) => boolean;
};

export function CommandSidebar({
  deckItems,
  isDeckLoading,
  deckLoadError,
  historyEntries,
  selectedHistoryEntryId,
  historyQuery,
  isHistoryLoading,
  isHistorySearching,
  historyLoadError,
  onHistorySearchTermChange,
  onToggleHistoryStatus,
  onClearHistoryQuery,
  onSelectHistoryEntry,
  onClearHistorySelection,
  onAddHistoryToDeck,
  onUpdateDeckItem,
  onRemoveDeckItem,
  onRunCommand,
}: CommandSidebarProps) {
  const deckHistoryIds = new Set(
    deckItems.flatMap(({ sourceHistoryId }) =>
      sourceHistoryId ? [sourceHistoryId] : [],
    ),
  );

  return (
    <aside
      className="flex min-h-0 w-[clamp(19rem,31vw,25rem)] shrink-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#090d14] shadow-2xl shadow-black/20"
      aria-label="Command History and Command Deck"
    >
      <CommandDeckSection
        items={deckItems}
        isLoading={isDeckLoading}
        loadError={deckLoadError}
        onRun={onRunCommand}
        onUpdate={onUpdateDeckItem}
        onRemove={onRemoveDeckItem}
      />
      <CommandHistorySection
        entries={historyEntries}
        selectedEntryId={selectedHistoryEntryId}
        deckHistoryIds={deckHistoryIds}
        query={historyQuery}
        isLoading={isHistoryLoading}
        isSearching={isHistorySearching}
        loadError={historyLoadError}
        onSearchTermChange={onHistorySearchTermChange}
        onToggleStatus={onToggleHistoryStatus}
        onClearQuery={onClearHistoryQuery}
        onSelectEntry={onSelectHistoryEntry}
        onClearSelection={onClearHistorySelection}
        onRunAgain={onRunCommand}
        onAddToDeck={onAddHistoryToDeck}
      />
    </aside>
  );
}
