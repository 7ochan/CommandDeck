import { memo, useCallback, useId, type KeyboardEvent } from 'react';

import { getCommandHistoryStatus } from '@/shared/history-status';

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
      className={`group/history relative isolate overflow-hidden rounded-lg border transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out motion-reduce:transition-none ${
        isSelected
          ? 'border-emerald-300/45 bg-emerald-300/8 shadow-[0_8px_24px_rgba(0,0,0,0.25)]'
          : 'border-white/8 bg-white/3 hover:-translate-y-px hover:border-white/15 hover:bg-white/5'
      }`}
    >
      <button
        ref={buttonRef}
        type="button"
        className="group w-full cursor-pointer p-3 text-left focus-visible:ring-2 focus-visible:ring-emerald-300/80 focus-visible:outline-none focus-visible:ring-inset"
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
          <span className="block min-w-0 flex-1 overflow-hidden font-mono text-[12px] leading-4.5 break-words whitespace-pre-wrap text-slate-200">
            <HighlightedText text={entry.command} searchTerm={searchTerm} />
          </span>
          <StatusBadge status={status} exitCode={entry.exitCode} />
        </div>

        <p
          className="mt-2 truncate font-mono text-[10px] text-slate-500"
          title={entry.cwd}
        >
          <HighlightedText text={entry.cwd} searchTerm={searchTerm} />
        </p>

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/6 pt-2 font-mono text-[9px] text-slate-600">
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
    status === 'success' ? '✓' : status === 'failed' ? `× ${exitCode}` : '■';
  const className =
    status === 'success'
      ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200'
      : status === 'failed'
        ? 'border-rose-300/25 bg-rose-300/10 text-rose-200'
        : 'border-amber-300/25 bg-amber-300/10 text-amber-200';

  return (
    <span
      className={`inline-flex shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] ${className}`}
      aria-label={`${status}, exit code ${exitCode}`}
    >
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
