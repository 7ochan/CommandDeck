'use client';

import { memo, useId, useMemo, useState, type KeyboardEvent } from 'react';

import { parseCommandTemplate } from '@/shared/command-template';
import { Icon, type IconName } from '@/components/ui/icon';

import type { CommandDeckItem as CommandDeckItemModel } from '../types.ts';
import { CommandTemplateHighlight } from './command-template-highlight.tsx';
import { EditDeckItemDialog } from './edit-deck-item-dialog.tsx';
import { ExecuteCommandTemplateDialog } from './execute-command-template-dialog.tsx';

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
      className={`cd-deck-card relative isolate overflow-hidden rounded-sm border transition-[border-color,background-color,box-shadow] ${
        isSelected
          ? 'cd-deck-card--selected border-[var(--accent-border)] bg-[var(--accent-soft)]'
          : 'border-[var(--border-soft)] bg-[var(--canvas-raised)] hover:border-[var(--border)] hover:bg-[var(--surface-2)]'
      }`}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          className="min-w-0 flex-1 cursor-pointer px-2.5 py-2 text-left focus-visible:outline-offset-[-2px]"
          aria-expanded={isSelected}
          aria-controls={actionPanelId}
          aria-pressed={isSelected}
          aria-keyshortcuts="Enter"
          tabIndex={isTabStop ? 0 : -1}
          title="Select command shortcut"
          onClick={() => onSelect(item.deckItemId)}
          onKeyDown={handleKeyDown}
        >
          <h3 className="truncate text-[12px] font-semibold text-[var(--text-primary)]">
            {item.displayName}
          </h3>
          <pre className="mt-1 max-h-9 overflow-hidden font-mono text-[11px] leading-[1.1rem] break-words whitespace-pre-wrap text-[var(--text-secondary)]">
            <CommandTemplateHighlight parsed={parsedTemplate} />
          </pre>
          {item.description && (
            <p className="mt-1 truncate text-[10px] leading-4 text-[var(--text-muted)]">
              {item.description}
            </p>
          )}
        </button>

        <button
          type="button"
          className="cd-clay-tile cd-clay-tile--accent m-1.5 ml-0 flex w-7.5 shrink-0 items-center justify-center rounded-sm hover:text-[var(--accent-strong)]"
          aria-label={`Run ${item.displayName}`}
          title="Run command"
          onClick={run}
        >
          <Icon name="play" size={13} />
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
            className="border-t border-[var(--border-soft)] px-2.5 py-2.5"
            aria-label="Command Deck item actions"
          >
            <div className="grid grid-cols-3 gap-1.5">
              <DeckActionButton icon="play" label="Run" onClick={run} />
              <DeckActionButton
                icon="edit"
                label="Edit"
                disabled={isRemoving}
                onClick={() => setEditOpen(true)}
              />
              <DeckActionButton
                icon="trash"
                label={isRemoving ? 'Removing…' : 'Remove'}
                tone="danger"
                disabled={isRemoving}
                onClick={() => void remove()}
              />
            </div>
            <p
              className="min-h-4 pt-1.5 text-center text-[10px] text-[var(--text-muted)]"
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
  icon: IconName;
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
      className={`flex min-w-0 items-center justify-center gap-1.5 rounded-md border px-1 py-1.5 text-center text-[10px] leading-4 font-medium transition-[background-color,border-color,color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === 'danger'
          ? 'border-transparent text-[var(--danger)] hover:border-[rgb(239_141_152_/_18%)] hover:bg-[var(--danger-soft)]'
          : 'cd-deck-card border-[var(--border-soft)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
      }`}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} size={13} />
      <span>{label}</span>
    </button>
  );
}
