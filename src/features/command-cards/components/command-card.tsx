import { useId } from 'react';

import { CommandCardActions } from './command-card-actions';
import type { CommandCard as CommandCardModel } from '../types';

type CommandCardProps = {
  card: CommandCardModel;
  isSelected: boolean;
  onSelect: (commandId: string) => void;
  onRunAgain: (command: string) => boolean;
  onDelete: (commandId: string) => Promise<void>;
};

const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export function CommandCard({
  card,
  isSelected,
  onSelect,
  onRunAgain,
  onDelete,
}: CommandCardProps) {
  const succeeded = card.exitCode === 0;
  const actionPanelId = useId();

  return (
    <article
      className={`overflow-hidden rounded-xl border transition-colors ${
        isSelected
          ? 'border-emerald-300/45 bg-emerald-300/8 shadow-[0_0_0_1px_rgba(110,231,183,0.08)]'
          : 'border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5'
      }`}
    >
      <button
        type="button"
        className="group w-full p-4 text-left focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:outline-none focus-visible:ring-inset"
        aria-expanded={isSelected}
        aria-controls={actionPanelId}
        aria-pressed={isSelected}
        onClick={() => onSelect(card.commandId)}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="block min-w-0 flex-1 overflow-hidden font-mono text-[13px] leading-5 break-words whitespace-pre-wrap text-slate-200">
            {card.command}
          </span>
          <span
            className={`shrink-0 rounded-md border px-2 py-0.5 font-mono text-[10px] ${
              succeeded
                ? 'border-emerald-300/20 bg-emerald-300/8 text-emerald-300'
                : 'border-rose-300/20 bg-rose-300/8 text-rose-300'
            }`}
          >
            exit {card.exitCode}
          </span>
        </div>

        <p
          className="mt-3 truncate font-mono text-[11px] text-slate-500"
          title={card.cwd}
        >
          {card.cwd}
        </p>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/6 pt-3 font-mono text-[10px] text-slate-500">
          <span>{formatDuration(card.durationMs)}</span>
          <span
            title={`Started ${new Date(card.startedAt).toLocaleString()} · Finished ${new Date(card.endedAt).toLocaleString()}`}
          >
            {TIME_FORMATTER.format(card.startedAt)} →{' '}
            {TIME_FORMATTER.format(card.endedAt)}
          </span>
        </div>

        <span className="mt-2 flex items-center justify-center font-mono text-[9px] text-slate-600 transition-colors group-hover:text-slate-400">
          <span
            className={`transition-transform ${isSelected ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            ▾
          </span>
          <span className="sr-only">
            {isSelected ? 'Collapse actions' : 'Expand actions'}
          </span>
        </span>
      </button>

      {isSelected && (
        <CommandCardActions
          card={card}
          panelId={actionPanelId}
          onRunAgain={onRunAgain}
          onDelete={onDelete}
        />
      )}
    </article>
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
