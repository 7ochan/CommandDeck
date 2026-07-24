import { HistoryEntryActions } from '@/features/command-history/components/history-entry-actions';
import { getCommandHistoryStatus } from '@/shared/history-status';
import type { CommandHistoryEntry } from '@/shared/types';

import { formatTimelineDateTime, formatTimelineDuration } from '../format';
import { StatusLabel } from './timeline-event';

type TimelineEventDetailsProps = {
  entry: CommandHistoryEntry | null;
  isInDeck: boolean;
  onClose: () => void;
  onRunAgain: (command: string) => boolean;
  onAddToDeck: (historyId: string) => Promise<void>;
};

export function TimelineEventDetails({
  entry,
  isInDeck,
  onClose,
  onRunAgain,
  onAddToDeck,
}: TimelineEventDetailsProps) {
  if (!entry) {
    return (
      <aside className="flex min-h-0 w-[clamp(18rem,27vw,23rem)] shrink-0 items-center justify-center rounded-xl border border-white/9 bg-[#090d14] p-6 text-center">
        <div>
          <span className="font-mono text-lg text-cyan-300/35">◎</span>
          <h2 className="mt-3 text-xs font-medium text-slate-300">
            Event details
          </h2>
          <p className="mt-1.5 text-[10px] leading-4 text-slate-600">
            Select a command in the Timeline to inspect its execution context.
          </p>
        </div>
      </aside>
    );
  }

  const status = getCommandHistoryStatus(entry);

  return (
    <aside className="command-history-scrollbar min-h-0 w-[clamp(18rem,27vw,23rem)] shrink-0 overflow-y-auto rounded-xl border border-white/9 bg-[#090d14]">
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
        <div>
          <h2 className="text-xs font-medium text-slate-200">Event details</h2>
          <p className="mt-1 font-mono text-[9px] text-slate-600">
            Immutable History record
          </p>
        </div>
        <button
          type="button"
          className="rounded-md border border-white/8 px-2 py-1 text-[10px] text-slate-500 hover:bg-white/5 hover:text-slate-300 focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:outline-none"
          aria-label="Close event details"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <span className="text-[9px] tracking-wide text-slate-600 uppercase">
            Command
          </span>
          <StatusLabel status={status} exitCode={entry.exitCode} />
        </div>
        <pre className="mt-2 max-h-44 overflow-auto rounded-lg border border-white/8 bg-black/20 p-3 font-mono text-[11px] leading-5 break-words whitespace-pre-wrap text-slate-200">
          {entry.command}
        </pre>

        <Detail label="Working directory">
          <span className="break-all">{entry.cwd}</span>
        </Detail>
        <Detail label="Started">
          {formatTimelineDateTime(entry.startedAt)}
        </Detail>
        <Detail label="Completed">
          {formatTimelineDateTime(entry.endedAt)}
        </Detail>
        <Detail label="Duration">
          {formatTimelineDuration(entry.durationMs)}
        </Detail>
        <Detail label="Exit code">{entry.exitCode}</Detail>
        <Detail label="Completion reason">{entry.completionReason}</Detail>
      </div>

      <HistoryEntryActions
        entry={entry}
        panelId="timeline-event-actions"
        isInDeck={isInDeck}
        onRunAgain={onRunAgain}
        onAddToDeck={onAddToDeck}
      />
    </aside>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <dl className="mt-4 border-t border-white/7 pt-3">
      <dt className="text-[8px] tracking-wide text-slate-600 uppercase">
        {label}
      </dt>
      <dd className="mt-1.5 font-mono text-[10px] leading-4 text-slate-400">
        {children}
      </dd>
    </dl>
  );
}
