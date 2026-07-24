import { memo } from 'react';

import { HighlightedText } from '@/features/command-history/components/highlighted-text';
import { getCommandHistoryStatus } from '@/shared/history-status';
import type { CommandHistoryEntry } from '@/shared/types';

import {
  formatTimelineDateTime,
  formatTimelineDuration,
  formatTimelineTime,
} from '../format';

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
        className={`absolute top-4 left-[0.2rem] size-2.5 rounded-full border-2 border-[#0b1018] ring-1 ${statusDotClass(status)}`}
        aria-hidden="true"
      />
      <button
        type="button"
        aria-pressed={isSelected}
        className={`w-full rounded-lg border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:outline-none ${
          isSelected
            ? 'border-emerald-300/35 bg-emerald-300/8'
            : 'border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5'
        }`}
        onClick={() => onSelect(entry.commandId)}
      >
        <div className="flex items-start gap-3">
          <time
            dateTime={new Date(entry.endedAt).toISOString()}
            title={formatTimelineDateTime(entry.endedAt)}
            className="w-[4.5rem] shrink-0 pt-0.5 font-mono text-[9px] text-slate-600"
          >
            {formatTimelineTime(entry.endedAt)}
          </time>
          <code className="min-w-0 flex-1 overflow-hidden font-mono text-[12px] leading-5 break-words whitespace-pre-wrap text-slate-200">
            <HighlightedText text={entry.command} searchTerm={searchTerm} />
          </code>
          <StatusLabel status={status} exitCode={entry.exitCode} />
        </div>
        <div className="mt-2 flex min-w-0 items-center gap-3 pl-[5.25rem] font-mono text-[9px] text-slate-600">
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
      ? 'border-emerald-300/20 bg-emerald-300/8 text-emerald-200'
      : status === 'failed'
        ? 'border-rose-300/20 bg-rose-300/8 text-rose-200'
        : 'border-amber-300/20 bg-amber-300/8 text-amber-200';

  return (
    <span
      className={`shrink-0 rounded border px-2 py-0.5 text-[9px] capitalize ${className}`}
      aria-label={`${status}, exit code ${exitCode}`}
    >
      {status}
    </span>
  );
}

function statusDotClass(
  status: ReturnType<typeof getCommandHistoryStatus>,
): string {
  return status === 'success'
    ? 'bg-emerald-300 ring-emerald-300/30'
    : status === 'failed'
      ? 'bg-rose-300 ring-rose-300/30'
      : 'bg-amber-300 ring-amber-300/30';
}
