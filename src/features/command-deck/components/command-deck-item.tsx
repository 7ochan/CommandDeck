'use client';

import { memo, useId, useMemo, useState, type KeyboardEvent } from 'react';

import { parseCommandTemplate } from '@/shared/command-template';

import type { CommandDeckItem as CommandDeckItemModel } from '../types';
import { CommandTemplateHighlight } from './command-template-highlight';
import { EditDeckItemDialog } from './edit-deck-item-dialog';
import { ExecuteCommandTemplateDialog } from './execute-command-template-dialog';

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
  const [executeTemplateOpen, setExecuteTemplateOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const parsedTemplate = useMemo(
    () => parseCommandTemplate(item.command),
    [item.command],
  );

  const run = () => {
    if (!parsedTemplate.isValid) {
      setStatusMessage(
        parsedTemplate.errors[0]?.message ??
          'Fix the template syntax before running this item.',
      );
      return false;
    }

    if (parsedTemplate.placeholders.length > 0) {
      setStatusMessage(null);
      setExecuteTemplateOpen(true);
      return false;
    }

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
      className={`relative isolate overflow-hidden rounded-lg border transition-[border-color,background-color] ${
        isSelected
          ? 'border-cyan-300/30 bg-cyan-300/[0.065]'
          : 'border-transparent bg-white/[0.025] hover:border-white/8 hover:bg-white/[0.045]'
      }`}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          className="min-w-0 flex-1 cursor-pointer px-2.5 py-2 text-left focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:outline-none focus-visible:ring-inset"
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
          <h3 className="truncate text-[11px] font-medium text-slate-200">
            {item.displayName}
          </h3>
          <pre className="mt-1 max-h-8 overflow-hidden font-mono text-[10px] leading-4 break-words whitespace-pre-wrap text-slate-500">
            <CommandTemplateHighlight parsed={parsedTemplate} />
          </pre>
          {item.description && (
            <p className="mt-1 truncate text-[9px] leading-4 text-slate-600">
              {item.description}
            </p>
          )}
        </button>

        <button
          type="button"
          className="m-1.5 ml-0 flex w-8 shrink-0 items-center justify-center rounded-md bg-cyan-300/[0.065] text-[10px] text-cyan-200/70 transition-colors hover:bg-cyan-300/12 hover:text-cyan-100 focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:outline-none"
          aria-label={`Run ${item.displayName}`}
          title="Run command"
          onClick={run}
        >
          <span aria-hidden="true">▶</span>
        </button>
      </div>

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
            className="border-t border-white/6 px-2 py-2"
            aria-label="Command Deck item actions"
          >
            <div className="grid grid-cols-3 gap-1">
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
              className="min-h-3 pt-1 text-center text-[8px] text-slate-500"
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
      <ExecuteCommandTemplateDialog
        displayName={item.displayName}
        template={item.command}
        isOpen={executeTemplateOpen}
        onCancel={() => setExecuteTemplateOpen(false)}
        onExecute={(command) => {
          const executed = onRun(command);
          setStatusMessage(
            executed
              ? 'Expanded command sent to the active terminal.'
              : 'The active terminal is not connected.',
          );
          return executed;
        }}
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
      className={`flex min-w-0 items-center justify-center gap-1 rounded-md px-1 py-1.5 text-center text-[9px] leading-3 transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === 'danger'
          ? 'text-rose-300/70 hover:bg-rose-300/8 focus-visible:ring-rose-300/70'
          : 'bg-white/[0.025] text-slate-400 hover:bg-white/6 hover:text-slate-200 focus-visible:ring-cyan-300/70'
      }`}
      disabled={disabled}
      onClick={onClick}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
