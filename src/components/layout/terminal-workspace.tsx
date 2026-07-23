'use client';

import { CommandCardPanel } from '@/features/command-cards/components/command-card-panel';
import { useCommandCards } from '@/features/command-cards/hooks/use-command-cards';
import { Terminal } from '@/features/terminal/components/terminal';

export function TerminalWorkspace() {
  const { cards, selectedCardId, addCompletedCommand, selectCard } =
    useCommandCards();

  return (
    <div className="flex min-h-0 flex-1 gap-3">
      <Terminal onCommandCompleted={addCompletedCommand} />
      <CommandCardPanel
        cards={cards}
        selectedCardId={selectedCardId}
        onSelectCard={selectCard}
      />
    </div>
  );
}
