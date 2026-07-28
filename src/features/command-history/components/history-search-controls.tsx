import { memo } from 'react';

import { Icon } from '@/components/ui/icon';
import { COMMAND_HISTORY_STATUSES } from '@/shared/history-status';
import type { CommandHistoryQuery, CommandHistoryStatus } from '@/shared/types';

type HistorySearchControlsProps = {
  query: CommandHistoryQuery;
  isSearching: boolean;
  onSearchTermChange: (searchTerm: string) => void;
  onToggleStatus: (status: CommandHistoryStatus) => void;
};

const STATUS_LABELS: Record<CommandHistoryStatus, string> = {
  success: 'Success',
  failed: 'Failed',
  interrupted: 'Interrupted',
};

const STATUS_STYLES: Record<CommandHistoryStatus, string> = {
  success:
    'aria-pressed:border-[var(--accent-border)] aria-pressed:bg-[var(--accent-soft)] aria-pressed:text-[var(--accent-strong)]',
  failed:
    'aria-pressed:border-[rgb(239_141_152_/_30%)] aria-pressed:bg-[var(--danger-soft)] aria-pressed:text-[var(--danger)]',
  interrupted:
    'aria-pressed:border-[rgb(232_185_106_/_30%)] aria-pressed:bg-[var(--warning-soft)] aria-pressed:text-[var(--warning)]',
};

const SHORT_STATUS_LABELS: Record<CommandHistoryStatus, string> = {
  success: 'Success',
  failed: 'Failed',
  interrupted: 'Cancel',
};

export const HistorySearchControls = memo(function HistorySearchControls({
  query,
  isSearching,
  onSearchTermChange,
  onToggleStatus,
}: HistorySearchControlsProps) {
  return (
    <div className="shrink-0 border-b border-[var(--border-soft)] p-2.5">
      <div className="relative">
        <span
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[var(--text-muted)]"
          aria-hidden="true"
        >
          <Icon name="search" size={13} />
        </span>
        <input
          type="search"
          value={query.searchTerm}
          maxLength={200}
          placeholder="Search command or directory…"
          aria-label="Search Command History"
          className="cd-input h-8 pr-7 pl-7 font-mono text-[11px]"
          onChange={(event) => onSearchTermChange(event.currentTarget.value)}
        />
        {isSearching && (
          <span
            className="absolute top-1/2 right-2.5 size-3 -translate-y-1/2 animate-spin rounded-full border border-[var(--text-subtle)] border-t-[var(--accent)] motion-reduce:animate-none"
            aria-label="Updating History results"
            role="status"
          />
        )}
      </div>

      <div
        className="cd-no-scrollbar mt-2 flex items-center gap-1.5 overflow-x-auto py-0.5"
        aria-label="Filter History by status"
      >
        {COMMAND_HISTORY_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={query.statuses.includes(status)}
            title={`Filter by ${STATUS_LABELS[status]}`}
            className={`flex h-6.5 shrink-0 items-center justify-center gap-1.5 rounded-sm border border-[var(--border-soft)] bg-[var(--canvas-raised)] px-2 text-[10px] font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)] ${STATUS_STYLES[status]}`}
            onClick={() => onToggleStatus(status)}
          >
            <span
              className={`size-1.5 shrink-0 rounded-full ${
                status === 'success'
                  ? 'bg-[var(--accent)]'
                  : status === 'failed'
                    ? 'bg-[var(--danger)]'
                    : 'bg-[var(--warning)]'
              }`}
              aria-hidden="true"
            />
            <span className="font-mono text-[10px] whitespace-nowrap">
              {STATUS_LABELS[status]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
});
