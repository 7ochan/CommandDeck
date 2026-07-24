import { memo, useState } from 'react';

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
    <section className="overflow-hidden rounded-xl border border-white/9 bg-[#0b1018]">
      <button
        type="button"
        className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-white/3 focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:outline-none focus-visible:ring-inset"
        aria-expanded={isExpanded}
        aria-controls={eventListId}
        onClick={() => setIsExpanded((current) => !current)}
      >
        <span
          className={`text-[10px] text-slate-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          aria-hidden="true"
        >
          ▶
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-medium text-slate-200">
            Activity Session
          </h3>
          <p className="mt-1 truncate font-mono text-[9px] text-slate-600">
            {formatTimelineDateTime(session.startedAt)}
          </p>
        </div>
        <dl className="grid shrink-0 grid-cols-3 gap-5 text-right">
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
          className="relative space-y-2 border-t border-white/7 px-4 py-3 before:absolute before:top-3 before:bottom-3 before:left-[1.28rem] before:w-px before:bg-white/8"
        >
          {hiddenEventCount > 0 && (
            <li className="relative pl-7">
              <button
                type="button"
                className="w-full rounded-lg border border-dashed border-white/9 px-3 py-2 text-[9px] text-slate-500 hover:border-white/15 hover:text-slate-300 focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:outline-none"
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
      <dt className="text-[8px] tracking-wide text-slate-700 uppercase">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-[9px] text-slate-400">{children}</dd>
    </div>
  );
}
