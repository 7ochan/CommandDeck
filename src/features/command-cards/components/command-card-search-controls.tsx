import { memo } from 'react';

import { COMMAND_CARD_STATUSES } from '@/shared/command-card-status';
import type { CommandCardQuery, CommandCardStatus } from '@/shared/types';

type CommandCardSearchControlsProps = {
  query: CommandCardQuery;
  isSearching: boolean;
  onSearchTermChange: (searchTerm: string) => void;
  onToggleStatus: (status: CommandCardStatus) => void;
};

const STATUS_LABELS: Record<CommandCardStatus, string> = {
  success: 'Success',
  failed: 'Failed',
  interrupted: 'Interrupted',
};

const STATUS_STYLES: Record<CommandCardStatus, string> = {
  success:
    'aria-pressed:border-emerald-300/35 aria-pressed:bg-emerald-300/12 aria-pressed:text-emerald-200',
  failed:
    'aria-pressed:border-rose-300/35 aria-pressed:bg-rose-300/12 aria-pressed:text-rose-200',
  interrupted:
    'aria-pressed:border-amber-300/35 aria-pressed:bg-amber-300/12 aria-pressed:text-amber-200',
};

export const CommandCardSearchControls = memo(
  function CommandCardSearchControls({
    query,
    isSearching,
    onSearchTermChange,
    onToggleStatus,
  }: CommandCardSearchControlsProps) {
    return (
      <div className="shrink-0 border-b border-white/8 p-3">
        <div className="relative">
          <span
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs text-slate-500"
            aria-hidden="true"
          >
            ⌕
          </span>
          <input
            type="search"
            value={query.searchTerm}
            maxLength={200}
            placeholder="Search command or directory…"
            aria-label="Search command cards"
            className="h-9 w-full rounded-lg border border-white/10 bg-black/20 pr-8 pl-8 font-mono text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-emerald-300/45 focus:ring-2 focus:ring-emerald-300/10"
            onChange={(event) => onSearchTermChange(event.currentTarget.value)}
          />
          {isSearching && (
            <span
              className="absolute top-1/2 right-3 size-3 -translate-y-1/2 animate-spin rounded-full border border-slate-600 border-t-emerald-300 motion-reduce:animate-none"
              aria-label="Updating results"
              role="status"
            />
          )}
        </div>

        <div
          className="mt-2 grid grid-cols-3 gap-1.5"
          aria-label="Filter by status"
        >
          {COMMAND_CARD_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={query.statuses.includes(status)}
              className={`rounded-md border border-white/8 bg-white/3 px-2 py-1.5 text-[10px] text-slate-500 transition-colors hover:border-white/15 hover:text-slate-300 focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:outline-none ${STATUS_STYLES[status]}`}
              onClick={() => onToggleStatus(status)}
            >
              {STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </div>
    );
  },
);
