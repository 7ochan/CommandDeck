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
        className="rounded-[2px] bg-[rgb(232_185_106_/_22%)] px-px text-[#f4d59d]"
      >
        {segment.text}
      </mark>
    ) : (
      segment.text
    ),
  );
});
