'use client';

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

import {
  getNavigatedCardId,
  hasNewLeadingCard,
  isNearCardListTop,
  shouldClearCardSelection,
  type CardNavigationDirection,
} from '../card-list-behavior';
import { CommandCard } from './command-card';
import type { CommandCard as CommandCardModel } from '../types';

type CommandCardPanelProps = {
  cards: CommandCardModel[];
  selectedCardId: string | null;
  isLoading: boolean;
  loadError: string | null;
  onSelectCard: (commandId: string) => void;
  onClearSelection: () => void;
  onRunAgain: (command: string) => boolean;
  onDeleteCard: (commandId: string) => Promise<void>;
};

export function CommandCardPanel({
  cards,
  selectedCardId,
  isLoading,
  loadError,
  onSelectCard,
  onClearSelection,
  onRunAgain,
  onDeleteCard,
}: CommandCardPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const cardButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const previousCardIdsRef = useRef<Set<string>>(new Set());
  const wasNearTopRef = useRef(true);
  const [interactionMessage, setInteractionMessage] = useState('');

  useLayoutEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const previousCardIds = previousCardIdsRef.current;

    if (
      scrollContainer &&
      !isLoading &&
      wasNearTopRef.current &&
      hasNewLeadingCard(previousCardIds, cards)
    ) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }

    previousCardIdsRef.current = new Set(
      cards.map(({ commandId }) => commandId),
    );
  }, [cards, isLoading]);

  const registerCardButton = useCallback(
    (commandId: string, button: HTMLButtonElement | null) => {
      if (button) {
        cardButtonRefs.current.set(commandId, button);
      } else {
        cardButtonRefs.current.delete(commandId);
      }
    },
    [],
  );

  const rerunCommand = useCallback(
    (command: string) => {
      const reran = onRunAgain(command);
      setInteractionMessage(
        reran
          ? 'Command sent to the active terminal.'
          : 'The active terminal is not connected.',
      );
      return reran;
    },
    [onRunAgain],
  );

  const navigateCards = useCallback(
    (commandId: string, direction: CardNavigationDirection) => {
      const targetId = getNavigatedCardId(cards, commandId, direction);

      if (!targetId) {
        return;
      }

      onSelectCard(targetId);
      cardButtonRefs.current.get(targetId)?.focus({ preventScroll: true });
      cardButtonRefs.current
        .get(targetId)
        ?.scrollIntoView({ block: 'nearest' });
    },
    [cards, onSelectCard],
  );

  const deleteCard = useCallback(
    async (commandId: string) => {
      const deletedIndex = cards.findIndex(
        (card) => card.commandId === commandId,
      );
      const focusTarget =
        cards[deletedIndex + 1] ?? cards[deletedIndex - 1] ?? null;

      await onDeleteCard(commandId);

      requestAnimationFrame(() => {
        if (focusTarget) {
          cardButtonRefs.current.get(focusTarget.commandId)?.focus();
        } else {
          panelRef.current?.focus();
        }
      });
    },
    [cards, onDeleteCard],
  );

  const handlePanelKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!shouldClearCardSelection(event.key) || !selectedCardId) {
      return;
    }

    const eventTarget = event.target;

    if (eventTarget instanceof Element && eventTarget.closest('dialog[open]')) {
      return;
    }

    event.preventDefault();
    cardButtonRefs.current.get(selectedCardId)?.focus();
    onClearSelection();
    setInteractionMessage('Command card selection cleared.');
  };

  return (
    <aside
      ref={panelRef}
      className="flex min-h-0 w-[clamp(18rem,30vw,24rem)] shrink-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#090d14] shadow-2xl shadow-black/20"
      aria-label="Command cards"
      tabIndex={-1}
      onKeyDown={handlePanelKeyDown}
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
        <span
          className={`size-1.5 rounded-full transition-colors ${
            cards.length > 0 ? 'bg-emerald-300/80' : 'bg-slate-700'
          }`}
        />
      </div>

      <p className="sr-only" aria-live="polite">
        {interactionMessage}
      </p>

      {cards.length === 0 ? (
        <CommandCardEmptyState isLoading={isLoading} loadError={loadError} />
      ) : (
        <div
          ref={scrollContainerRef}
          className="command-card-scrollbar min-h-0 flex-1 overflow-y-auto p-3"
          onScroll={(event) => {
            wasNearTopRef.current = isNearCardListTop(
              event.currentTarget.scrollTop,
            );
          }}
        >
          {loadError && (
            <p className="mb-3 rounded-lg border border-amber-300/15 bg-amber-300/5 px-3 py-2 text-xs leading-5 text-amber-200/70">
              {loadError}
            </p>
          )}
          <div className="flex flex-col gap-2.5">
            {cards.map((card, index) => (
              <CommandCard
                key={card.commandId}
                card={card}
                isSelected={card.commandId === selectedCardId}
                isTabStop={
                  card.commandId === selectedCardId ||
                  (!selectedCardId && index === 0)
                }
                buttonRef={(button) =>
                  registerCardButton(card.commandId, button)
                }
                onSelect={onSelectCard}
                onNavigate={navigateCards}
                onRunAgain={rerunCommand}
                onDelete={deleteCard}
              />
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

type CommandCardEmptyStateProps = {
  isLoading: boolean;
  loadError: string | null;
};

function CommandCardEmptyState({
  isLoading,
  loadError,
}: CommandCardEmptyStateProps) {
  const title = isLoading
    ? 'Loading command cards'
    : loadError
      ? 'Command history unavailable'
      : 'Your command history starts here';
  const description =
    loadError ??
    (isLoading
      ? 'Reading your local command history.'
      : 'Run a command in the terminal and it will become a reusable card.');

  return (
    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-8 text-center">
      <div
        className="pointer-events-none absolute inset-x-12 top-1/3 h-32 rounded-full bg-emerald-300/5 blur-3xl"
        aria-hidden="true"
      />
      <div
        className={`relative mb-5 flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] shadow-[0_16px_40px_rgba(0,0,0,0.3)] ${
          isLoading ? 'animate-pulse motion-reduce:animate-none' : ''
        }`}
        aria-hidden="true"
      >
        <span className="font-mono text-lg font-semibold text-emerald-300/80">
          {isLoading ? '…' : '>_'}
        </span>
      </div>
      <h3 className="relative text-sm font-medium text-slate-300">{title}</h3>
      <p className="relative mt-2 max-w-56 text-xs leading-5 text-slate-500">
        {description}
      </p>
      {!isLoading && !loadError && (
        <span className="relative mt-5 rounded-md border border-white/8 bg-white/3 px-2.5 py-1 font-mono text-[10px] text-slate-600">
          Commands appear here automatically
        </span>
      )}
    </div>
  );
}
