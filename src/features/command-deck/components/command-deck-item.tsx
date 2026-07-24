'use client';

import { memo, useId, useState, type KeyboardEvent } from 'react';

import type { CommandDeckItem as CommandDeckItemModel } from '../types';
import { EditDeckItemDialog } from './edit-deck-item-dialog';

type CommandDeckItemProps = {
  item: CommandDeckItemModel;
  isSelected: boolean;
  isTabStop: boolean;
  onSelect: (deckItemId: string) => void;
  onRun: (command: string) => boolean;
  onUpdate: (
    deckItemId: string,
    update: {
      displayName?: string;
      command?: string;
      description?: string | null;
    },
  ) => Promise<void>;
  onRemove: (deckItemId: string) => Promise<void>;
};

export const CommandDeckItem = memo(function CommandDeckItem({
  item,
  isSelected,
  isTabStop,
  onSelect,
  onRun,
  onUpdate,
  onRemove,
}: CommandDeckItemProps) {
  const actionPanelId = useId();
  const [editOpen, setEditOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const run = () => {
    const executed = onRun(item.command);
    setStatusMessage(
      executed
        ? 'Command sent to the active terminal.'
        : 'The active terminal is not connected.',
    );
    return executed;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      run();
    }
  };

  const remove = async () => {
    setIsRemoving(true);
    setStatusMessage(null);

    try {
      await onRemove(item.deckItemId);
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : 'Unable to remove this Deck item.',
      );
      setIsRemoving(false);
    }
  };

  return (
    <article
      className={`relative isolate overflow-hidden rounded-lg border transition-colors ${
        isSelected
          ? 'border-cyan-300/45 bg-cyan-300/8 shadow-[0_8px_24px_rgba(0,0,0,0.25)]'
          : 'border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5'
      }`}
    >
      <button
        type="button"
        className="w-full cursor-pointer p-3 text-left focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:outline-none focus-visible:ring-inset"
        aria-expanded={isSelected}
        aria-controls={actionPanelId}
        aria-pressed={isSelected}
        aria-keyshortcuts="Enter"
        tabIndex={isTabStop ? 0 : -1}
        title="Select · Double-click or press Enter to run"
        onClick={() => onSelect(item.deckItemId)}
        onDoubleClick={run}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 truncate text-xs font-medium text-slate-200">
            {item.displayName}
          </h3>
          <span
            className="shrink-0 rounded border border-cyan-300/20 bg-cyan-300/8 px-1.5 py-0.5 font-mono text-[8px] text-cyan-200/80"
            aria-hidden="true"
          >
            DECK
          </span>
        </div>
        <pre className="mt-2 overflow-hidden font-mono text-[10px] leading-4 break-words whitespace-pre-wrap text-slate-400">
          {item.command}
        </pre>
        {item.description && (
          <p className="mt-2 text-[10px] leading-4 text-slate-500">
            {item.description}
          </p>
        )}
      </button>

      <div
        className={`grid transition-[grid-template-rows,opacity] duration-200 motion-reduce:transition-none ${
          isSelected
            ? 'grid-rows-[1fr] opacity-100'
            : 'grid-rows-[0fr] opacity-0'
        }`}
        aria-hidden={!isSelected}
        inert={!isSelected}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            id={actionPanelId}
            className="border-t border-white/6 px-2.5 py-2.5"
            aria-label="Command Deck item actions"
          >
            <div className="grid grid-cols-3 gap-1.5">
              <DeckActionButton icon="▶" label="Run" onClick={run} />
              <DeckActionButton
                icon="✎"
                label="Edit"
                disabled={isRemoving}
                onClick={() => setEditOpen(true)}
              />
              <DeckActionButton
                icon="−"
                label={isRemoving ? 'Removing…' : 'Remove'}
                tone="danger"
                disabled={isRemoving}
                onClick={() => void remove()}
              />
            </div>
            <p
              className="min-h-4 pt-1.5 text-center text-[9px] text-slate-500"
              aria-live="polite"
            >
              {statusMessage}
            </p>
          </div>
        </div>
      </div>

      <EditDeckItemDialog
        item={item}
        isOpen={editOpen}
        onCancel={() => setEditOpen(false)}
        onSave={(update) => onUpdate(item.deckItemId, update)}
      />
    </article>
  );
});

type DeckActionButtonProps = {
  icon: string;
  label: string;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  onClick: () => void;
};

function DeckActionButton({
  icon,
  label,
  tone = 'default',
  disabled = false,
  onClick,
}: DeckActionButtonProps) {
  return (
    <button
      type="button"
      className={`flex min-w-0 flex-col items-center gap-1 rounded-lg border px-1 py-1.5 text-center text-[9px] leading-3.5 transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === 'danger'
          ? 'border-rose-300/10 text-rose-300/75 hover:border-rose-300/20 hover:bg-rose-300/8 focus-visible:ring-rose-300/70'
          : 'border-white/7 text-slate-400 hover:border-white/12 hover:bg-white/5 hover:text-slate-200 focus-visible:ring-cyan-300/70'
      }`}
      disabled={disabled}
      onClick={onClick}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
