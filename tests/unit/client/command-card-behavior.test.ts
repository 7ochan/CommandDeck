import { describe, expect, it } from 'vitest';

import {
  getCardNavigationDirection,
  getNavigatedCardId,
  hasNewLeadingCard,
  isNearCardListTop,
  shouldClearCardSelection,
  shouldRerunSelectedCard,
} from '../../../src/features/command-cards/card-list-behavior.js';
import type { CommandCard } from '../../../src/shared/types/command.js';

describe('Command Card interaction behavior', () => {
  it('reruns with Enter only when the focused card is selected', () => {
    expect(shouldRerunSelectedCard('Enter', true)).toBe(true);
    expect(shouldRerunSelectedCard('Enter', false)).toBe(false);
    expect(shouldRerunSelectedCard(' ', true)).toBe(false);
  });

  it('clears selection only for Escape', () => {
    expect(shouldClearCardSelection('Escape')).toBe(true);
    expect(shouldClearCardSelection('Enter')).toBe(false);
  });

  it('maps keyboard navigation and keeps movement within the card list', () => {
    const cards = [card('one'), card('two'), card('three')];

    expect(getCardNavigationDirection('ArrowDown')).toBe('next');
    expect(getCardNavigationDirection('ArrowUp')).toBe('previous');
    expect(getCardNavigationDirection('Home')).toBe('first');
    expect(getCardNavigationDirection('End')).toBe('last');
    expect(getCardNavigationDirection('Tab')).toBeNull();
    expect(getNavigatedCardId(cards, 'two', 'next')).toBe('three');
    expect(getNavigatedCardId(cards, 'one', 'previous')).toBe('one');
    expect(getNavigatedCardId(cards, 'two', 'first')).toBe('one');
  });

  it('autoscrolls only for a genuinely new leading card near the top', () => {
    const previousIds = new Set(['older']);

    expect(hasNewLeadingCard(previousIds, [card('new'), card('older')])).toBe(
      true,
    );
    expect(hasNewLeadingCard(previousIds, [card('older')])).toBe(false);
    expect(isNearCardListTop(80)).toBe(true);
    expect(isNearCardListTop(81)).toBe(false);
  });
});

function card(commandId: string): CommandCard {
  return {
    commandId,
    command: `printf ${commandId}`,
    cwd: '/tmp',
    exitCode: 0,
    startedAt: 1,
    endedAt: 2,
    durationMs: 1,
    completionReason: 'shell',
    createdAt: 3,
  };
}
