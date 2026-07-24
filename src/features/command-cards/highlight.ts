export type HighlightedTextSegment = {
  text: string;
  isMatch: boolean;
};

export function getHighlightedTextSegments(
  text: string,
  searchTerm: string,
): HighlightedTextSegment[] {
  const normalizedSearchTerm = searchTerm.trim();

  if (!normalizedSearchTerm) {
    return [{ text, isMatch: false }];
  }

  const matcher = new RegExp(
    escapeRegularExpression(normalizedSearchTerm),
    'gi',
  );
  const segments: HighlightedTextSegment[] = [];
  let previousEnd = 0;

  for (const match of text.matchAll(matcher)) {
    const matchStart = match.index;

    if (matchStart > previousEnd) {
      segments.push({
        text: text.slice(previousEnd, matchStart),
        isMatch: false,
      });
    }

    const matchedText = match[0];
    segments.push({ text: matchedText, isMatch: true });
    previousEnd = matchStart + matchedText.length;
  }

  if (segments.length === 0) {
    return [{ text, isMatch: false }];
  }

  if (previousEnd < text.length) {
    segments.push({ text: text.slice(previousEnd), isMatch: false });
  }

  return segments;
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
