import { describe, expect, it } from 'vitest';

import {
  expandCommandTemplate,
  getCommandTemplatePlaceholderLabel,
  parseCommandTemplate,
  previewCommandTemplate,
  validateCommandTemplateValues,
} from '../../../src/shared/command-template/index.js';

describe('Command Templates', () => {
  it('deduplicates placeholders in first-appearance order', () => {
    const parsed = parseCommandTemplate(
      'docker exec {{container}} sh -c "cd {{path}} && cat {{file}} {{container}}"',
    );

    expect(parsed.isValid).toBe(true);
    expect(parsed.placeholders.map(({ name }) => name)).toEqual([
      'container',
      'path',
      'file',
    ]);
    expect(parsed.occurrences.map(({ name }) => name)).toEqual([
      'container',
      'path',
      'file',
      'container',
    ]);
  });

  it('treats names case-sensitively and derives friendly labels', () => {
    const parsed = parseCommandTemplate(
      '{{Branch}} {{branch}} {{target_file}}',
    );

    expect(parsed.placeholders.map(({ name }) => name)).toEqual([
      'Branch',
      'branch',
      'target_file',
    ]);
    expect(parsed.placeholders.map(({ label }) => label)).toEqual([
      'Branch',
      'Branch',
      'Target file',
    ]);
    expect(getCommandTemplatePlaceholderLabel('containerName')).toBe(
      'Container Name',
    );
  });

  it.each([
    ['echo {{}}', 'empty-name'],
    ['echo {{ branch }}', 'invalid-name'],
    ['echo {{name', 'unclosed-placeholder'],
    ['echo name}}', 'unexpected-close'],
    ['echo {{outer {{inner}}', 'nested-placeholder'],
  ])('rejects malformed template %s', (template, errorCode) => {
    const parsed = parseCommandTemplate(template);

    expect(parsed.isValid).toBe(false);
    expect(parsed.errors.some(({ code }) => code === errorCode)).toBe(true);
  });

  it('expands multiple and duplicate placeholders with plain substitution', () => {
    const result = expandCommandTemplate(
      'scp {{file}} user@{{host}}:/tmp/{{file}}',
      { file: 'report $& \\ final.txt', host: 'server.example' },
    );

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        command:
          'scp report $& \\ final.txt user@server.example:/tmp/report $& \\ final.txt',
      }),
    );
  });

  it('provides a live partial preview without mutating the template', () => {
    const template = 'kubectl get pods -n {{namespace}} --context {{context}}';

    expect(previewCommandTemplate(template, { namespace: 'production' })).toBe(
      'kubectl get pods -n production --context {{context}}',
    );
    expect(template).toContain('{{namespace}}');
  });

  it('rejects missing, blank, and newly unresolved values', () => {
    const parsed = parseCommandTemplate('git checkout {{branch}} {{file}}');
    expect(
      validateCommandTemplateValues(parsed, { branch: 'main', file: '  ' }),
    ).toEqual([
      expect.objectContaining({ code: 'missing-value', name: 'file' }),
    ]);
    expect(
      expandCommandTemplate('echo {{value}}', { value: '{{other}}' }),
    ).toEqual(
      expect.objectContaining({
        ok: false,
        errors: [expect.objectContaining({ code: 'unresolved-placeholder' })],
      }),
    );
  });

  it('returns commands without placeholders unchanged', () => {
    expect(expandCommandTemplate('npm test', {})).toEqual(
      expect.objectContaining({ ok: true, command: 'npm test' }),
    );
  });
});
