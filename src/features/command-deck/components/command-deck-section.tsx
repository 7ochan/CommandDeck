'use client';

import { useMemo, useState, type DragEvent } from 'react';

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
  const [deckItemOrder, setDeckItemOrder] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('cmd-deck-items-order');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  const visibleSelectedId = items.some(
    ({ deckItemId }) => deckItemId === selectedItemId,
  )
    ? selectedItemId
    : null;

  const orderedItems = useMemo(() => {
    const map = new Map(items.map((item) => [item.deckItemId, item]));
    const ordered: CommandDeckItem[] = [];

    deckItemOrder.forEach((id) => {
      const item = map.get(id);
      if (item) {
        ordered.push(item);
        map.delete(id);
      }
    });

    map.forEach((item) => ordered.push(item));
    return ordered;
  }, [items, deckItemOrder]);

  const handleDragStart = (event: DragEvent, deckItemId: string) => {
    event.dataTransfer.setData('text/plain', deckItemId);
    event.dataTransfer.effectAllowed = 'move';
    setDraggedItemId(deckItemId);
  };

  const handleDragOver = (event: DragEvent, deckItemId: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (draggedItemId && draggedItemId !== deckItemId) {
      setDragOverItemId(deckItemId);
    }
  };

  const handleDrop = (event: DragEvent, targetDeckItemId: string) => {
    event.preventDefault();
    const sourceId = draggedItemId || event.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetDeckItemId) {
      setDraggedItemId(null);
      setDragOverItemId(null);
      return;
    }

    const currentIds = orderedItems.map((i) => i.deckItemId);
    const sourceIndex = currentIds.indexOf(sourceId);
    const targetIndex = currentIds.indexOf(targetDeckItemId);

    if (sourceIndex !== -1 && targetIndex !== -1) {
      const nextOrder = [...currentIds];
      const [moved] = nextOrder.splice(sourceIndex, 1);
      nextOrder.splice(targetIndex, 0, moved);
      setDeckItemOrder(nextOrder);
      try {
        localStorage.setItem('cmd-deck-items-order', JSON.stringify(nextOrder));
      } catch {}
    }

    setDraggedItemId(null);
    setDragOverItemId(null);
  };

  const handleToggleSelect = (deckItemId: string) => {
    setSelectedItemId((prev) => (prev === deckItemId ? null : deckItemId));
  };

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
            {orderedItems.map((item, index) => {
              const isDragging = draggedItemId === item.deckItemId;
              const isDragOver = dragOverItemId === item.deckItemId;

              return (
                <div
                  key={item.deckItemId}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item.deckItemId)}
                  onDragOver={(e) => handleDragOver(e, item.deckItemId)}
                  onDragLeave={() => setDragOverItemId(null)}
                  onDrop={(e) => handleDrop(e, item.deckItemId)}
                  onDragEnd={() => {
                    setDraggedItemId(null);
                    setDragOverItemId(null);
                  }}
                  className={`group relative cursor-grab rounded-[12px] transition-all active:cursor-grabbing ${
                    isDragging ? 'opacity-40' : ''
                  } ${
                    isDragOver
                      ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface-2)]'
                      : ''
                  }`}
                >
                  <CommandDeckItemView
                    item={item}
                    isSelected={item.deckItemId === visibleSelectedId}
                    isTabStop={
                      item.deckItemId === visibleSelectedId ||
                      (!visibleSelectedId && index === 0)
                    }
                    onSelect={handleToggleSelect}
                    onRun={onRun}
                    onUpdate={onUpdate}
                    onRemove={onRemove}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
