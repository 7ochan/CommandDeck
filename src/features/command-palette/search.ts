import type { RegisteredCommandPaletteAction } from './types';

export const COMMAND_PALETTE_RESULT_LIMIT = 100;

export type IndexedCommandPaletteAction = {
  action: RegisteredCommandPaletteAction;
  normalizedFields: string[];
};

export function buildCommandPaletteIndex(
  actions: RegisteredCommandPaletteAction[],
): IndexedCommandPaletteAction[] {
  return actions.map((action) => ({
    action,
    normalizedFields: [
      action.label,
      action.description ?? '',
      action.group,
      ...(action.keywords ?? []),
    ]
      .map(normalizeSearchValue)
      .filter(Boolean),
  }));
}

export function searchCommandPalette(
  index: IndexedCommandPaletteAction[],
  query: string,
  limit = COMMAND_PALETTE_RESULT_LIMIT,
): RegisteredCommandPaletteAction[] {
  const normalizedQuery = normalizeSearchValue(query);

  if (!normalizedQuery) {
    return index
      .map(({ action }) => action)
      .sort(compareActions)
      .slice(0, limit);
  }

  const exact: RegisteredCommandPaletteAction[] = [];
  const prefix: RegisteredCommandPaletteAction[] = [];
  const substring: RegisteredCommandPaletteAction[] = [];

  for (const entry of index) {
    if (entry.normalizedFields.some((field) => field === normalizedQuery)) {
      exact.push(entry.action);
    } else if (
      entry.normalizedFields.some((field) => field.startsWith(normalizedQuery))
    ) {
      prefix.push(entry.action);
    } else if (
      entry.normalizedFields.some((field) => field.includes(normalizedQuery))
    ) {
      substring.push(entry.action);
    }
  }

  exact.sort(compareActions);
  prefix.sort(compareActions);
  substring.sort(compareActions);
  return [...exact, ...prefix, ...substring].slice(0, limit);
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function compareActions(
  left: RegisteredCommandPaletteAction,
  right: RegisteredCommandPaletteAction,
): number {
  return (
    (right.priority ?? 0) - (left.priority ?? 0) || left.order - right.order
  );
}
