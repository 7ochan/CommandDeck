import { memo } from 'react';

import { HighlightedText } from '@/features/command-history/components/highlighted-text';
import { Icon } from '@/components/ui/icon';
import { getCommandHistoryStatus } from '@/shared/history-status';
import type { CommandHistoryEntry } from '@/shared/types';

import {
  formatTimelineDateTime,
  formatTimelineDuration,
  formatTimelineTime,
} from '../format.ts';

type TimelineEventProps = {
  entry: CommandHistoryEntry;
  isSelected: boolean;
  searchTerm: string;
  onSelect: (commandId: string) => void;
};

export const TimelineEvent = memo(function TimelineEvent({
  entry,
  isSelected,
  searchTerm,
  onSelect,
}: TimelineEventProps) {
  const status = getCommandHistoryStatus(entry);

  return (
    <li className="relative pl-7">
      <span
        className={`absolute top-4 left-[0.2rem] size-2.5 rounded-full border-2 border-[var(--canvas-raised)] ring-1 ${statusDotClass(status)}`}
        aria-hidden="true"
      />
      <button
        type="button"
        aria-pressed={isSelected}
        className={`cd-event-row w-full rounded-[9px] border p-3 text-left transition-[background-color,border-color,box-shadow] ${
          isSelected
            ? 'cd-event-row--selected border-[var(--accent-border)] bg-[var(--accent-soft)]'
            : 'border-[var(--border-soft)] bg-[var(--surface-1)] hover:border-[var(--border)] hover:bg-[var(--surface-2)]'
        }`}
        onClick={() => onSelect(entry.commandId)}
      >
        <div className="flex items-start gap-3">
          <time
            dateTime={new Date(entry.endedAt).toISOString()}
            title={formatTimelineDateTime(entry.endedAt)}
            className="hidden w-[4.5rem] shrink-0 pt-0.5 font-mono text-[10px] text-[var(--text-muted)] sm:block"
          >
            {formatTimelineTime(entry.endedAt)}
          </time>
          <code className="min-w-0 flex-1 overflow-hidden font-mono text-[12px] leading-5 break-words whitespace-pre-wrap text-[var(--text-primary)]">
            <HighlightedText text={entry.command} searchTerm={searchTerm} />
          </code>
          <StatusLabel status={status} exitCode={entry.exitCode} />
        </div>
        <div className="mt-2 flex min-w-0 items-center gap-3 font-mono text-[10px] text-[var(--text-muted)] sm:pl-[5.25rem]">
          <span className="min-w-0 flex-1 truncate" title={entry.cwd}>
            <HighlightedText text={entry.cwd} searchTerm={searchTerm} />
          </span>
          <span className="shrink-0">
            {formatTimelineDuration(entry.durationMs)}
          </span>
          <span className="shrink-0">exit {entry.exitCode}</span>
        </div>
      </button>
    </li>
  );
});

export function StatusLabel({
  status,
  exitCode,
}: {
  status: ReturnType<typeof getCommandHistoryStatus>;
  exitCode: number;
}) {
  const className =
    status === 'success'
      ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
      : status === 'failed'
        ? 'border-[rgb(239_141_152_/_24%)] bg-[var(--danger-soft)] text-[var(--danger)]'
        : 'border-[rgb(232_185_106_/_24%)] bg-[var(--warning-soft)] text-[var(--warning)]';

  return (
    <span
      className={`flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-medium capitalize ${className}`}
      aria-label={`${status}, exit code ${exitCode}`}
    >
      <Icon
        name={
          status === 'success' ? 'check' : status === 'failed' ? 'x' : 'stop'
        }
        size={10}
        strokeWidth={2}
      />
      <span className="hidden sm:inline">{status}</span>
    </span>
  );
}

function statusDotClass(
  status: ReturnType<typeof getCommandHistoryStatus>,
): string {
  return status === 'success'
    ? 'bg-[var(--accent)] ring-[rgb(115_217_173_/_30%)]'
    : status === 'failed'
      ? 'bg-[var(--danger)] ring-[rgb(239_141_152_/_30%)]'
      : 'bg-[var(--warning)] ring-[rgb(232_185_106_/_30%)]';
}
