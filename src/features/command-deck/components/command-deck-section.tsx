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
      className="flex max-h-[46%] min-h-40 shrink-0 flex-col border-b border-white/10"
      aria-labelledby="command-deck-title"
    >
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/8 px-3">
        <div className="flex items-center gap-2">
          <h2
            id="command-deck-title"
            className="font-mono text-[11px] font-medium text-cyan-100"
          >
            Command Deck
          </h2>
          <span className="rounded-full bg-cyan-300/8 px-1.5 py-0.5 font-mono text-[9px] text-cyan-200/60">
            {items.length}
          </span>
        </div>
        <span className="font-mono text-[8px] tracking-wide text-cyan-200/35 uppercase">
          Curated
        </span>
      </div>

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
        <div className="command-deck-scrollbar min-h-0 flex-1 overflow-y-auto p-2.5">
          {loadError && (
            <p className="mb-2 rounded-lg border border-amber-300/15 bg-amber-300/5 px-3 py-2 text-[10px] text-amber-200/70">
              {loadError}
            </p>
          )}
          <div className="flex flex-col gap-2">
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
