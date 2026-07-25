import { memo, useCallback, useId, type KeyboardEvent } from 'react';

import { getCommandHistoryStatus } from '@/shared/history-status';
import { Icon } from '@/components/ui/icon';

import {
  getHistoryNavigationDirection,
  shouldRerunSelectedHistoryEntry,
  type HistoryNavigationDirection,
} from '../history-list-behavior';
import type { CommandHistoryEntry as CommandHistoryEntryModel } from '../types';
import { HighlightedText } from './highlighted-text';
import { HistoryEntryActions } from './history-entry-actions';

type HistoryEntryProps = {
  entry: CommandHistoryEntryModel;
  isSelected: boolean;
  isTabStop: boolean;
  isInDeck: boolean;
  searchTerm: string;
  registerButton: (commandId: string, button: HTMLButtonElement | null) => void;
  onSelect: (commandId: string) => void;
  onNavigate: (
    commandId: string,
    direction: HistoryNavigationDirection,
  ) => void;
  onRunAgain: (command: string) => boolean;
  onAddToDeck: (historyId: string) => Promise<void>;
};

const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export const CommandHistoryEntry = memo(function CommandHistoryEntry({
  entry,
  isSelected,
  isTabStop,
  isInDeck,
  searchTerm,
  registerButton,
  onSelect,
  onNavigate,
  onRunAgain,
  onAddToDeck,
}: HistoryEntryProps) {
  const status = getCommandHistoryStatus(entry);
  const actionPanelId = useId();
  const buttonRef = useCallback(
    (button: HTMLButtonElement | null) =>
      registerButton(entry.commandId, button),
    [entry.commandId, registerButton],
  );
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (shouldRerunSelectedHistoryEntry(event.key, isSelected)) {
      event.preventDefault();
      onRunAgain(entry.command);
      return;
    }

    const navigationDirection = getHistoryNavigationDirection(event.key);

    if (navigationDirection) {
      event.preventDefault();
      onNavigate(entry.commandId, navigationDirection);
    }
  };

  return (
    <article
      className={`group/history relative isolate overflow-hidden rounded-[10px] border transition-[border-color,background-color,box-shadow] duration-150 motion-reduce:transition-none ${
        isSelected
          ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] shadow-[0_8px_20px_rgba(0,0,0,0.18)]'
          : 'border-[var(--border-soft)] bg-[var(--canvas-raised)] hover:border-[var(--border)] hover:bg-[var(--surface-2)]'
      }`}
    >
      <button
        ref={buttonRef}
        type="button"
        className="group w-full cursor-pointer p-3 text-left focus-visible:outline-offset-[-2px]"
        aria-expanded={isSelected}
        aria-controls={actionPanelId}
        aria-pressed={isSelected}
        aria-keyshortcuts="Enter"
        tabIndex={isTabStop ? 0 : -1}
        title="Select · Double-click or press Enter to run again"
        onClick={() => onSelect(entry.commandId)}
        onDoubleClick={() => onRunAgain(entry.command)}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="block min-w-0 flex-1 overflow-hidden font-mono text-[12px] leading-[1.15rem] break-words whitespace-pre-wrap text-[var(--text-primary)]">
            <HighlightedText text={entry.command} searchTerm={searchTerm} />
          </span>
          <StatusBadge status={status} exitCode={entry.exitCode} />
        </div>

        <p
          className="mt-2 truncate font-mono text-[10px] text-[var(--text-muted)]"
          title={entry.cwd}
        >
          <HighlightedText text={entry.cwd} searchTerm={searchTerm} />
        </p>

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--border-soft)] pt-2 font-mono text-[10px] text-[var(--text-muted)]">
          <span>{formatDuration(entry.durationMs)}</span>
          <span>{TIME_FORMATTER.format(entry.endedAt)}</span>
        </div>
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
          <HistoryEntryActions
            entry={entry}
            panelId={actionPanelId}
            isInDeck={isInDeck}
            onRunAgain={onRunAgain}
            onAddToDeck={onAddToDeck}
          />
        </div>
      </div>
    </article>
  );
});

type HistoryStatus = ReturnType<typeof getCommandHistoryStatus>;

function StatusBadge({
  status,
  exitCode,
}: {
  status: HistoryStatus;
  exitCode: number;
}) {
  const label =
    status === 'success'
      ? 'Success'
      : status === 'failed'
        ? `Failed ${exitCode}`
        : 'Interrupted';
  const className =
    status === 'success'
      ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
      : status === 'failed'
        ? 'border-[rgb(239_141_152_/_24%)] bg-[var(--danger-soft)] text-[var(--danger)]'
        : 'border-[rgb(232_185_106_/_24%)] bg-[var(--warning-soft)] text-[var(--warning)]';

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-medium ${className}`}
      aria-label={`${status}, exit code ${exitCode}`}
    >
      <Icon
        name={
          status === 'success' ? 'check' : status === 'failed' ? 'x' : 'stop'
        }
        size={10}
        strokeWidth={2}
      />
      <span aria-hidden="true">{label}</span>
    </span>
  );
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1_000) {
    return `${durationMs} ms`;
  }

  if (durationMs < 60_000) {
    return `${(durationMs / 1_000).toFixed(durationMs < 10_000 ? 1 : 0)} s`;
  }

  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.floor((durationMs % 60_000) / 1_000);
  return `${minutes}m ${seconds}s`;
}
