import type { CommandCard } from './types';

export const CARD_LIST_NEAR_TOP_PX = 80;

export type CardNavigationDirection = 'first' | 'last' | 'next' | 'previous';

export function shouldRerunSelectedCard(
  key: string,
  isSelected: boolean,
): boolean {
  return key === 'Enter' && isSelected;
}

export function shouldClearCardSelection(key: string): boolean {
  return key === 'Escape';
}

export function getCardNavigationDirection(
  key: string,
): CardNavigationDirection | null {
  if (key === 'ArrowDown') {
    return 'next';
  }

  if (key === 'ArrowUp') {
    return 'previous';
  }

  if (key === 'Home') {
    return 'first';
  }

  if (key === 'End') {
    return 'last';
  }

  return null;
}

export function isNearCardListTop(
  scrollTop: number,
  threshold = CARD_LIST_NEAR_TOP_PX,
): boolean {
  return scrollTop <= threshold;
}

export function hasNewLeadingCard(
  previousCardIds: ReadonlySet<string>,
  cards: readonly CommandCard[],
): boolean {
  const leadingCard = cards[0];
  return Boolean(leadingCard && !previousCardIds.has(leadingCard.commandId));
}

export function getNavigatedCardId(
  cards: readonly CommandCard[],
  currentId: string,
  direction: CardNavigationDirection,
): string | null {
  const currentIndex = cards.findIndex(
    ({ commandId }) => commandId === currentId,
  );

  if (currentIndex === -1 || cards.length === 0) {
    return null;
  }

  const targetIndex =
    direction === 'first'
      ? 0
      : direction === 'last'
        ? cards.length - 1
        : direction === 'next'
          ? Math.min(currentIndex + 1, cards.length - 1)
          : Math.max(currentIndex - 1, 0);

  return cards[targetIndex]?.commandId ?? null;
}
