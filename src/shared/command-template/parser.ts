export const COMMAND_TEMPLATE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export type CommandTemplatePlaceholder = {
  name: string;
  label: string;
  token: string;
};

export type CommandTemplateOccurrence = CommandTemplatePlaceholder & {
  start: number;
  end: number;
};

export type CommandTemplateSyntaxError = {
  kind: 'syntax';
  code:
    | 'empty-name'
    | 'invalid-name'
    | 'nested-placeholder'
    | 'unclosed-placeholder'
    | 'unexpected-close';
  message: string;
  start: number;
  end: number;
};

export type ParsedCommandTemplate = {
  template: string;
  placeholders: CommandTemplatePlaceholder[];
  occurrences: CommandTemplateOccurrence[];
  errors: CommandTemplateSyntaxError[];
  isValid: boolean;
};

export function parseCommandTemplate(template: string): ParsedCommandTemplate {
  const placeholders: CommandTemplatePlaceholder[] = [];
  const occurrences: CommandTemplateOccurrence[] = [];
  const errors: CommandTemplateSyntaxError[] = [];
  const seenNames = new Set<string>();
  let cursor = 0;

  while (cursor < template.length) {
    const openIndex = template.indexOf('{{', cursor);
    const closeBeforeOpen = template.indexOf('}}', cursor);

    if (
      closeBeforeOpen !== -1 &&
      (openIndex === -1 || closeBeforeOpen < openIndex)
    ) {
      errors.push({
        kind: 'syntax',
        code: 'unexpected-close',
        message: 'Found a closing “}}” without a matching “{{”.',
        start: closeBeforeOpen,
        end: closeBeforeOpen + 2,
      });
      cursor = closeBeforeOpen + 2;
      continue;
    }

    if (openIndex === -1) {
      break;
    }

    const closeIndex = template.indexOf('}}', openIndex + 2);

    if (closeIndex === -1) {
      errors.push({
        kind: 'syntax',
        code: 'unclosed-placeholder',
        message: 'Close this placeholder with “}}”.',
        start: openIndex,
        end: template.length,
      });
      break;
    }

    const nestedOpenIndex = template.indexOf('{{', openIndex + 2);

    if (nestedOpenIndex !== -1 && nestedOpenIndex < closeIndex) {
      errors.push({
        kind: 'syntax',
        code: 'nested-placeholder',
        message: 'Nested placeholders are not supported.',
        start: openIndex,
        end: closeIndex + 2,
      });
      cursor = closeIndex + 2;
      continue;
    }

    const name = template.slice(openIndex + 2, closeIndex);
    const token = template.slice(openIndex, closeIndex + 2);

    if (name.length === 0) {
      errors.push({
        kind: 'syntax',
        code: 'empty-name',
        message: 'Placeholder names cannot be empty.',
        start: openIndex,
        end: closeIndex + 2,
      });
    } else if (!COMMAND_TEMPLATE_NAME_PATTERN.test(name)) {
      errors.push({
        kind: 'syntax',
        code: 'invalid-name',
        message:
          name.trim() !== name
            ? 'Remove spaces inside the placeholder braces.'
            : 'Use letters, numbers, and underscores; start with a letter or underscore.',
        start: openIndex,
        end: closeIndex + 2,
      });
    } else {
      const placeholder = {
        name,
        label: getCommandTemplatePlaceholderLabel(name),
        token,
      };
      occurrences.push({
        ...placeholder,
        start: openIndex,
        end: closeIndex + 2,
      });

      if (!seenNames.has(name)) {
        seenNames.add(name);
        placeholders.push(placeholder);
      }
    }

    cursor = closeIndex + 2;
  }

  return {
    template,
    placeholders,
    occurrences,
    errors,
    isValid: errors.length === 0,
  };
}

export function getCommandTemplatePlaceholderLabel(name: string): string {
  const words = name
    .replaceAll('_', ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();

  return words ? `${words[0]?.toUpperCase() ?? ''}${words.slice(1)}` : name;
}
