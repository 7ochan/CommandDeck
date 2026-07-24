'use client';

import { useCallback, useRef } from 'react';

import { CommandCardPanel } from '@/features/command-cards/components/command-card-panel';
import { useCommandCards } from '@/features/command-cards/hooks/use-command-cards';
import {
  Terminal,
  type TerminalHandle,
} from '@/features/terminal/components/terminal';

export function TerminalWorkspace() {
  const terminalRef = useRef<TerminalHandle>(null);
  const {
    cards,
    selectedCardId,
    query,
    isLoading,
    isSearching,
    loadError,
    addCompletedCommand,
    setSearchTerm,
    toggleStatus,
    clearQuery,
    selectCard,
    clearSelection,
    deleteCard,
  } = useCommandCards();
  const runCommandAgain = useCallback(
    (command: string) => terminalRef.current?.runCommand(command) ?? false,
    [],
  );

  return (
    <div className="flex min-h-0 flex-1 gap-3">
      <Terminal ref={terminalRef} onCommandCompleted={addCompletedCommand} />
      <CommandCardPanel
        cards={cards}
        selectedCardId={selectedCardId}
        query={query}
        isLoading={isLoading}
        isSearching={isSearching}
        loadError={loadError}
        onSearchTermChange={setSearchTerm}
        onToggleStatus={toggleStatus}
        onClearQuery={clearQuery}
        onSelectCard={selectCard}
        onClearSelection={clearSelection}
        onRunAgain={runCommandAgain}
        onDeleteCard={deleteCard}
      />
    </div>
  );
}
