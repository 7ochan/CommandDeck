'use client';

import { useState } from 'react';

import { Icon } from '@/components/ui/icon';
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
        <div className="flex min-h-32 flex-1 flex-col items-center justify-center px-6 text-center">
          <span className="cd-empty-mark" aria-hidden="true">
            {isLoading ? (
              <span className="size-4 animate-spin rounded-full border border-[var(--text-subtle)] border-t-[var(--accent)] motion-reduce:animate-none" />
            ) : (
              <Icon name="deck" size={18} />
            )}
          </span>
          <h3 className="mt-3 text-[13px] font-semibold text-[var(--text-secondary)]">
            {isLoading
              ? 'Loading Command Deck'
              : loadError
                ? 'Command Deck unavailable'
                : 'Curate your first command'}
          </h3>
          <p className="mt-1.5 max-w-56 text-[11px] leading-4.5 text-[var(--text-muted)]">
            {loadError ??
              'Choose Add to Deck from any History entry for quick reuse.'}
          </p>
        </div>
      ) : (
        <div className="command-deck-scrollbar min-h-0 flex-1 overflow-y-auto p-2.5">
          {loadError && (
            <p className="mb-2 rounded-lg border border-[rgb(232_185_106_/_20%)] bg-[var(--warning-soft)] px-3 py-2 text-[11px] text-[var(--warning)]">
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
