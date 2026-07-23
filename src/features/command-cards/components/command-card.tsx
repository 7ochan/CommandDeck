import { useId, type KeyboardEvent, type Ref } from 'react';

import {
  getCardNavigationDirection,
  shouldRerunSelectedCard,
  type CardNavigationDirection,
} from '../card-list-behavior';
import { CommandCardActions } from './command-card-actions';
import type { CommandCard as CommandCardModel } from '../types';

type CommandCardProps = {
  card: CommandCardModel;
  isSelected: boolean;
  isTabStop: boolean;
  buttonRef: Ref<HTMLButtonElement>;
  onSelect: (commandId: string) => void;
  onNavigate: (commandId: string, direction: CardNavigationDirection) => void;
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
  isTabStop,
  buttonRef,
  onSelect,
  onNavigate,
  onRunAgain,
  onDelete,
}: CommandCardProps) {
  const succeeded = card.exitCode === 0;
  const actionPanelId = useId();
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (shouldRerunSelectedCard(event.key, isSelected)) {
      event.preventDefault();
      onRunAgain(card.command);
      return;
    }

    const navigationDirection = getCardNavigationDirection(event.key);

    if (navigationDirection) {
      event.preventDefault();
      onNavigate(card.commandId, navigationDirection);
    }
  };

  return (
    <article
      className={`group/card relative isolate overflow-hidden rounded-xl border transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out motion-reduce:transition-none ${
        isSelected
          ? 'border-emerald-300/55 bg-[linear-gradient(145deg,rgba(16,185,129,0.12),rgba(255,255,255,0.035))] shadow-[0_12px_32px_rgba(0,0,0,0.32),0_0_0_1px_rgba(110,231,183,0.1)]'
          : 'border-white/8 bg-white/3 hover:-translate-y-px hover:border-white/18 hover:bg-white/5 hover:shadow-[0_10px_24px_rgba(0,0,0,0.22)]'
      }`}
    >
      <span
        className={`absolute inset-y-3 left-0 w-0.5 rounded-r-full transition-opacity duration-200 ${
          isSelected ? 'bg-emerald-300 opacity-100' : 'opacity-0'
        }`}
        aria-hidden="true"
      />
      <button
        ref={buttonRef}
        type="button"
        className="group w-full cursor-pointer p-4 text-left focus-visible:ring-2 focus-visible:ring-emerald-300/80 focus-visible:outline-none focus-visible:ring-inset"
        aria-expanded={isSelected}
        aria-controls={actionPanelId}
        aria-pressed={isSelected}
        aria-keyshortcuts="Enter"
        tabIndex={isTabStop ? 0 : -1}
        title="Click to select · Double-click or press Enter to run again"
        onClick={() => onSelect(card.commandId)}
        onDoubleClick={() => onRunAgain(card.command)}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="block min-w-0 flex-1 overflow-hidden font-mono text-[13px] leading-5 break-words whitespace-pre-wrap text-slate-200">
            {card.command}
          </span>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] font-medium ${
              succeeded
                ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200'
                : 'border-rose-300/25 bg-rose-300/10 text-rose-200'
            }`}
            aria-label={
              succeeded
                ? 'Success, exit code 0'
                : `Failed, exit code ${card.exitCode}`
            }
          >
            <span aria-hidden="true">
              {succeeded ? '✓ Success' : `× Failed · ${card.exitCode}`}
            </span>
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

      <div
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${
          isSelected
            ? 'grid-rows-[1fr] opacity-100'
            : 'grid-rows-[0fr] opacity-0'
        }`}
        aria-hidden={!isSelected}
        inert={!isSelected}
      >
        <div className="min-h-0 overflow-hidden">
          <CommandCardActions
            card={card}
            panelId={actionPanelId}
            onRunAgain={onRunAgain}
            onDelete={onDelete}
          />
        </div>
      </div>
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
