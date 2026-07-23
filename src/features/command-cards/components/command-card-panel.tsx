import { CommandCard } from './command-card';
import type { CommandCard as CommandCardModel } from '../types';

type CommandCardPanelProps = {
  cards: CommandCardModel[];
  selectedCardId: string | null;
  isLoading: boolean;
  loadError: string | null;
  onSelectCard: (commandId: string) => void;
  onRunAgain: (command: string) => boolean;
  onDeleteCard: (commandId: string) => Promise<void>;
};

export function CommandCardPanel({
  cards,
  selectedCardId,
  isLoading,
  loadError,
  onSelectCard,
  onRunAgain,
  onDeleteCard,
}: CommandCardPanelProps) {
  return (
    <aside
      className="flex min-h-0 w-[clamp(18rem,30vw,24rem)] shrink-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#090d14] shadow-2xl shadow-black/20"
      aria-label="Command cards"
    >
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/8 px-4">
        <div className="flex items-center gap-2">
          <h2 className="font-mono text-xs font-medium text-slate-300">
            Command cards
          </h2>
          {cards.length > 0 && (
            <span className="rounded-full bg-white/6 px-2 py-0.5 font-mono text-[10px] text-slate-500">
              {cards.length}
            </span>
          )}
        </div>
        <span className="size-1.5 rounded-full bg-emerald-300/80" />
      </div>

      {cards.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 text-center">
          <span className="mb-4 flex size-10 items-center justify-center rounded-lg border border-white/8 bg-white/3 font-mono text-sm text-slate-500">
            {isLoading ? '…' : '_'}
          </span>
          <p className="text-sm text-slate-400">
            {isLoading
              ? 'Loading command cards'
              : loadError
                ? 'Command history unavailable'
                : 'No completed commands yet'}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {loadError ??
              (isLoading
                ? 'Reading your local command history.'
                : 'Run a command and it will appear here automatically.')}
          </p>
        </div>
      ) : (
        <div className="command-card-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
          {loadError && (
            <p className="mb-3 rounded-lg border border-amber-300/15 bg-amber-300/5 px-3 py-2 text-xs leading-5 text-amber-200/70">
              {loadError}
            </p>
          )}
          <div className="flex flex-col gap-2.5">
            {cards.map((card) => (
              <CommandCard
                key={card.commandId}
                card={card}
                isSelected={card.commandId === selectedCardId}
                onSelect={onSelectCard}
                onRunAgain={onRunAgain}
                onDelete={onDeleteCard}
              />
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
