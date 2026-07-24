import type {
  CommandTemplateSyntaxError,
  ParsedCommandTemplate,
} from './parser.ts';
import { parseCommandTemplate } from './parser.ts';

export type CommandTemplateValues = Readonly<Record<string, string>>;

export type CommandTemplateValueError = {
  kind: 'value';
  code: 'missing-value';
  name: string;
  message: string;
};

export type CommandTemplateUnresolvedError = {
  kind: 'unresolved';
  code: 'unresolved-placeholder';
  message: string;
};

export type CommandTemplateValidationError =
  | CommandTemplateSyntaxError
  | CommandTemplateValueError
  | CommandTemplateUnresolvedError;

export type CommandTemplateValidation = {
  isValid: boolean;
  parsed: ParsedCommandTemplate;
  errors: CommandTemplateValidationError[];
};

export function validateCommandTemplate(
  template: string,
): CommandTemplateValidation {
  const parsed = parseCommandTemplate(template);
  return {
    isValid: parsed.isValid,
    parsed,
    errors: parsed.errors,
  };
}

export function validateCommandTemplateValues(
  parsed: ParsedCommandTemplate,
  values: CommandTemplateValues,
): CommandTemplateValidationError[] {
  const errors: CommandTemplateValidationError[] = [...parsed.errors];

  if (!parsed.isValid) {
    return errors;
  }

  for (const placeholder of parsed.placeholders) {
    const value = Object.hasOwn(values, placeholder.name)
      ? values[placeholder.name]
      : undefined;

    if (value === undefined || value.trim().length === 0) {
      errors.push({
        kind: 'value',
        code: 'missing-value',
        name: placeholder.name,
        message: `${placeholder.label} is required.`,
      });
    }
  }

  return errors;
}
