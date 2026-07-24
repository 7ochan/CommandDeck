'use client';

import { useCallback, useRef } from 'react';

import { useCommandDeck } from '@/features/command-deck/hooks/use-command-deck';
import { useCommandHistory } from '@/features/command-history/hooks/use-command-history';
import {
  Terminal,
  type TerminalHandle,
} from '@/features/terminal/components/terminal';
import { CommandSidebar } from './command-sidebar';

export function TerminalWorkspace() {
  const terminalRef = useRef<TerminalHandle>(null);
  const {
    entries,
    selectedEntryId,
    query,
    isLoading,
    isSearching,
    loadError,
    addCompletedCommand,
    setSearchTerm,
    toggleStatus,
    clearQuery,
    selectEntry,
    clearSelection,
  } = useCommandHistory();
  const {
    items: deckItems,
    isLoading: isDeckLoading,
    loadError: deckLoadError,
    addFromHistory,
    updateItem,
    removeItem,
  } = useCommandDeck();
  const runCommandAgain = useCallback(
    (command: string) => terminalRef.current?.runCommand(command) ?? false,
    [],
  );

  return (
    <div className="flex min-h-0 flex-1 gap-3">
      <Terminal ref={terminalRef} onCommandCompleted={addCompletedCommand} />
      <CommandSidebar
        deckItems={deckItems}
        isDeckLoading={isDeckLoading}
        deckLoadError={deckLoadError}
        historyEntries={entries}
        selectedHistoryEntryId={selectedEntryId}
        historyQuery={query}
        isHistoryLoading={isLoading}
        isHistorySearching={isSearching}
        historyLoadError={loadError}
        onHistorySearchTermChange={setSearchTerm}
        onToggleHistoryStatus={toggleStatus}
        onClearHistoryQuery={clearQuery}
        onSelectHistoryEntry={selectEntry}
        onClearHistorySelection={clearSelection}
        onAddHistoryToDeck={addFromHistory}
        onUpdateDeckItem={updateItem}
        onRemoveDeckItem={removeItem}
        onRunCommand={runCommandAgain}
      />
    </div>
  );
}
