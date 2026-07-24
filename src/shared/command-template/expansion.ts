import { parseCommandTemplate, type ParsedCommandTemplate } from './parser.ts';
import {
  validateCommandTemplateValues,
  type CommandTemplateValidationError,
  type CommandTemplateValues,
} from './validation.ts';

export type CommandTemplateExpansion =
  | {
      ok: true;
      command: string;
      parsed: ParsedCommandTemplate;
    }
  | {
      ok: false;
      parsed: ParsedCommandTemplate;
      errors: CommandTemplateValidationError[];
    };

export function previewCommandTemplate(
  template: string,
  values: CommandTemplateValues,
): string {
  const parsed = parseCommandTemplate(template);
  return substituteOccurrences(parsed, values, false);
}

export function expandCommandTemplate(
  template: string,
  values: CommandTemplateValues,
): CommandTemplateExpansion {
  const parsed = parseCommandTemplate(template);
  const errors = validateCommandTemplateValues(parsed, values);

  if (errors.length > 0) {
    return { ok: false, parsed, errors };
  }

  const command = substituteOccurrences(parsed, values, true);
  const expandedParse = parseCommandTemplate(command);

  if (
    expandedParse.placeholders.length > 0 ||
    expandedParse.errors.length > 0
  ) {
    return {
      ok: false,
      parsed,
      errors: [
        {
          kind: 'unresolved',
          code: 'unresolved-placeholder',
          message:
            'The expanded command still contains placeholder syntax. Remove it from the entered values before running.',
        },
      ],
    };
  }

  return { ok: true, command, parsed };
}

function substituteOccurrences(
  parsed: ParsedCommandTemplate,
  values: CommandTemplateValues,
  requireValues: boolean,
): string {
  if (parsed.occurrences.length === 0) {
    return parsed.template;
  }

  const parts: string[] = [];
  let cursor = 0;

  for (const occurrence of parsed.occurrences) {
    parts.push(parsed.template.slice(cursor, occurrence.start));
    const value = values[occurrence.name];
    parts.push(
      value !== undefined && (requireValues || value.length > 0)
        ? value
        : occurrence.token,
    );
    cursor = occurrence.end;
  }

  parts.push(parsed.template.slice(cursor));
  return parts.join('');
}
