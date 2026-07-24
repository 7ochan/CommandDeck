import { describe, expect, it } from 'vitest';

import {
  buildCommandPaletteIndex,
  searchCommandPalette,
} from '../../../src/features/command-palette/search.js';
import type { RegisteredCommandPaletteAction } from '../../../src/features/command-palette/types.js';

describe('Command Palette search', () => {
  it('ranks exact matches before prefix and substring matches', () => {
    const actions = [
      action('substring', 'Open production timeline', 0),
      action('prefix', 'Timeline details', 1),
      action('exact', 'Timeline', 2),
    ];

    expect(
      searchCommandPalette(buildCommandPaletteIndex(actions), 'timeline').map(
        ({ id }) => id,
      ),
    ).toEqual(['exact', 'prefix', 'substring']);
  });

  it('matches normalized descriptions, groups, and keywords', () => {
    const actions = [
      action('workspace', 'Switch context', 0, {
        description: 'Default Workspace',
        group: 'Workspaces',
        keywords: ['open project'],
      }),
    ];
    const index = buildCommandPaletteIndex(actions);

    expect(searchCommandPalette(index, ' default   workspace ')).toHaveLength(
      1,
    );
    expect(searchCommandPalette(index, 'workspaces')).toHaveLength(1);
    expect(searchCommandPalette(index, 'open project')).toHaveLength(1);
  });

  it('uses priority and registration order as stable tie-breakers', () => {
    const actions = [
      action('later', 'Run tests later', 2),
      action('priority', 'Run tests now', 1, { priority: 10 }),
      action('first', 'Run tests first', 0),
    ];

    expect(
      searchCommandPalette(buildCommandPaletteIndex(actions), 'run tests').map(
        ({ id }) => id,
      ),
    ).toEqual(['priority', 'first', 'later']);
  });

  it('bounds the rendered result window for large registries', () => {
    const actions = Array.from({ length: 2_000 }, (_, index) =>
      action(`history-${index}`, `npm test ${index}`, index),
    );

    expect(
      searchCommandPalette(buildCommandPaletteIndex(actions), 'npm').length,
    ).toBe(100);
  });
});

function action(
  id: string,
  label: string,
  order: number,
  overrides: Partial<RegisteredCommandPaletteAction> = {},
): RegisteredCommandPaletteAction {
  return {
    id,
    label,
    group: 'Test',
    execute: () => undefined,
    registryId: `test:${id}`,
    order,
    ...overrides,
  };
}
