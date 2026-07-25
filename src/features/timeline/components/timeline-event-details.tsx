import { HistoryEntryActions } from '@/features/command-history/components/history-entry-actions';
import { Icon } from '@/components/ui/icon';
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
      <aside className="cd-surface hidden min-h-0 w-[clamp(20rem,27vw,23rem)] shrink-0 items-center justify-center rounded-[13px] p-6 text-center xl:flex">
        <div>
          <span className="cd-empty-mark">
            <Icon name="command" size={18} />
          </span>
          <h2 className="mt-3 text-[13px] font-semibold text-[var(--text-secondary)]">
            Event details
          </h2>
          <p className="mt-1.5 text-[11px] leading-4.5 text-[var(--text-muted)]">
            Select a command in the Timeline to inspect its execution context.
          </p>
        </div>
      </aside>
    );
  }

  const status = getCommandHistoryStatus(entry);

  return (
    <aside className="cd-surface command-history-scrollbar max-h-[44%] min-h-0 w-full shrink-0 overflow-y-auto rounded-[13px] xl:max-h-none xl:w-[clamp(20rem,27vw,23rem)]">
      <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-3.5">
        <div>
          <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">
            Event details
          </h2>
          <p className="mt-1 font-mono text-[10px] text-[var(--text-muted)]">
            Immutable History record
          </p>
        </div>
        <button
          type="button"
          className="cd-icon-button size-8"
          aria-label="Close event details"
          onClick={onClose}
        >
          <Icon name="x" size={14} />
        </button>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <span className="cd-eyebrow">Command</span>
          <StatusLabel status={status} exitCode={entry.exitCode} />
        </div>
        <pre className="cd-scrollbar mt-2 max-h-44 overflow-auto rounded-[9px] border border-[var(--border)] bg-[var(--canvas-raised)] p-3 font-mono text-[11px] leading-5 break-words whitespace-pre-wrap text-[var(--text-primary)]">
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
    <dl className="mt-4 border-t border-[var(--border-soft)] pt-3">
      <dt className="text-[9px] tracking-wide text-[var(--text-muted)] uppercase">
        {label}
      </dt>
      <dd className="mt-1.5 font-mono text-[11px] leading-4 text-[var(--text-secondary)]">
        {children}
      </dd>
    </dl>
  );
}
