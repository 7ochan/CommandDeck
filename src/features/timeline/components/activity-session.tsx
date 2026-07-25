import { memo, useState } from 'react';

import { Icon } from '@/components/ui/icon';
import type { ActivitySession as ActivitySessionModel } from '../activity-sessions';
import {
  formatTimelineDateTime,
  formatTimelineDuration,
  formatTimelineTime,
} from '../format';
import { TimelineEvent } from './timeline-event';

const EVENT_RENDER_BATCH_SIZE = 100;

type ActivitySessionProps = {
  session: ActivitySessionModel;
  defaultExpanded: boolean;
  selectedEventId: string | null;
  searchTerm: string;
  onSelectEvent: (commandId: string) => void;
};

export const ActivitySession = memo(function ActivitySession({
  session,
  defaultExpanded,
  selectedEventId,
  searchTerm,
  onSelectEvent,
}: ActivitySessionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [visibleEventCount, setVisibleEventCount] = useState(
    EVENT_RENDER_BATCH_SIZE,
  );
  const eventListId = `${session.sessionId}-events`;
  const hiddenEventCount = Math.max(
    0,
    session.events.length - visibleEventCount,
  );
  const visibleEvents = session.events.slice(-visibleEventCount);

  return (
    <section className="overflow-hidden rounded-[11px] border border-[var(--border)] bg-[var(--canvas-raised)]">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--surface-2)] focus-visible:outline-offset-[-2px]"
        aria-expanded={isExpanded}
        aria-controls={eventListId}
        onClick={() => setIsExpanded((current) => !current)}
      >
        <span
          className={`text-[var(--text-muted)] transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
          aria-hidden="true"
        >
          <Icon name="chevron-right" size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[12px] font-semibold text-[var(--text-primary)]">
            Activity Session
          </h3>
          <p className="mt-1 truncate font-mono text-[10px] text-[var(--text-muted)]">
            {formatTimelineDateTime(session.startedAt)}
          </p>
        </div>
        <dl className="hidden shrink-0 grid-cols-3 gap-5 text-right sm:grid">
          <SessionMetric label="Time">
            {formatTimelineTime(session.startedAt)}–
            {formatTimelineTime(session.endedAt)}
          </SessionMetric>
          <SessionMetric label="Duration">
            {formatTimelineDuration(session.durationMs)}
          </SessionMetric>
          <SessionMetric label="Commands">{session.commandCount}</SessionMetric>
        </dl>
      </button>

      {isExpanded && (
        <ol
          id={eventListId}
          className="relative space-y-2 border-t border-[var(--border-soft)] px-3 py-3 before:absolute before:top-3 before:bottom-3 before:left-[1.28rem] before:w-px before:bg-[var(--border)] sm:px-4"
        >
          {hiddenEventCount > 0 && (
            <li className="relative pl-7">
              <button
                type="button"
                className="w-full rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-[10px] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)]"
                onClick={() =>
                  setVisibleEventCount(
                    (current) => current + EVENT_RENDER_BATCH_SIZE,
                  )
                }
              >
                Show earlier commands ({hiddenEventCount} remaining)
              </button>
            </li>
          )}
          {visibleEvents.map((entry) => (
            <TimelineEvent
              key={entry.commandId}
              entry={entry}
              isSelected={entry.commandId === selectedEventId}
              searchTerm={searchTerm}
              onSelect={onSelectEvent}
            />
          ))}
        </ol>
      )}
    </section>
  );
});

function SessionMetric({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[9px] tracking-wide text-[var(--text-subtle)] uppercase">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-[10px] text-[var(--text-secondary)]">
        {children}
      </dd>
    </div>
  );
}
