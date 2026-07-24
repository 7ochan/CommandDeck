'use client';

import { useState } from 'react';

import type { CommandDeckItem, CommandDeckItemUpdate } from '../types';
import { CommandDeckItem as CommandDeckItemView } from './command-deck-item';

type CommandDeckSectionProps = {
  items: CommandDeckItem[];
  isLoading: boolean;
  loadError: string | null;
  onRun: (command: string) => boolean;
  onUpdate: (
    deckItemId: string,
    update: CommandDeckItemUpdate,
  ) => Promise<void>;
  onRemove: (deckItemId: string) => Promise<void>;
};

export function CommandDeckSection({
  items,
  isLoading,
  loadError,
  onRun,
  onUpdate,
  onRemove,
}: CommandDeckSectionProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const visibleSelectedId = items.some(
    ({ deckItemId }) => deckItemId === selectedItemId,
  )
    ? selectedItemId
    : null;

  return (
    <section
      className="flex min-h-0 flex-1 flex-col"
      aria-labelledby="command-deck-title"
    >
      <h2 id="command-deck-title" className="sr-only">
        Command Deck
      </h2>

      {items.length === 0 ? (
        <div className="flex min-h-28 flex-1 flex-col items-center justify-center px-6 text-center">
          <span
            className="font-mono text-lg text-cyan-300/50"
            aria-hidden="true"
          >
            {isLoading ? '…' : '✦'}
          </span>
          <h3 className="mt-2 text-xs font-medium text-slate-300">
            {isLoading
              ? 'Loading Command Deck'
              : loadError
                ? 'Command Deck unavailable'
                : 'Curate your first command'}
          </h3>
          <p className="mt-1 max-w-52 text-[10px] leading-4 text-slate-500">
            {loadError ??
              'Choose Add to Deck from any History entry for quick reuse.'}
          </p>
        </div>
      ) : (
        <div className="command-deck-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
          {loadError && (
            <p className="mb-2 rounded-lg border border-amber-300/15 bg-amber-300/5 px-3 py-2 text-[10px] text-amber-200/70">
              {loadError}
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            {items.map((item, index) => (
              <CommandDeckItemView
                key={item.deckItemId}
                item={item}
                isSelected={item.deckItemId === visibleSelectedId}
                isTabStop={
                  item.deckItemId === visibleSelectedId ||
                  (!visibleSelectedId && index === 0)
                }
                onSelect={setSelectedItemId}
                onRun={onRun}
                onUpdate={onUpdate}
                onRemove={onRemove}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
