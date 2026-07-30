import { memo } from 'react';

import { getHighlightedTextSegments } from '../highlight.ts';

type HighlightedTextProps = {
  text: string;
  searchTerm: string;
};

export const HighlightedText = memo(function HighlightedText({
  text,
  searchTerm,
}: HighlightedTextProps) {
  return getHighlightedTextSegments(text, searchTerm).map((segment, index) =>
    segment.isMatch ? (
      <mark
        key={index}
        className="rounded-[2px] bg-[rgb(232_185_106_/_22%)] px-px text-[var(--highlight-text)]"
      >
        {segment.text}
      </mark>
    ) : (
      segment.text
    ),
  );
});
