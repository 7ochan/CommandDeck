import { memo } from 'react';

import { getHighlightedTextSegments } from '../highlight';

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
        className="rounded-[2px] bg-amber-300/25 px-px text-amber-100"
      >
        {segment.text}
      </mark>
    ) : (
      segment.text
    ),
  );
});
