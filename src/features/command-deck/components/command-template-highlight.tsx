import type { ParsedCommandTemplate } from '@/shared/command-template';

type CommandTemplateHighlightProps = {
  parsed: ParsedCommandTemplate;
  className?: string;
};

export function CommandTemplateHighlight({
  parsed,
  className = '',
}: CommandTemplateHighlightProps) {
  if (parsed.occurrences.length === 0) {
    return <span className={className}>{parsed.template}</span>;
  }

  const content: React.ReactNode[] = [];
  let cursor = 0;

  for (const occurrence of parsed.occurrences) {
    if (occurrence.start > cursor) {
      content.push(parsed.template.slice(cursor, occurrence.start));
    }

    content.push(
      <mark
        key={`${occurrence.start}:${occurrence.end}`}
        className="rounded bg-[var(--info-soft)] px-0.5 text-[var(--info)] ring-1 ring-[rgb(119_189_251_/_22%)]"
      >
        {occurrence.token}
      </mark>,
    );
    cursor = occurrence.end;
  }

  content.push(parsed.template.slice(cursor));
  return <span className={className}>{content}</span>;
}
