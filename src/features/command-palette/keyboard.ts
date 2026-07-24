type CommandPaletteShortcut = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
};

export function isCommandPaletteShortcut(
  event: CommandPaletteShortcut,
): boolean {
  return (
    event.key.toLowerCase() === 'k' &&
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey
  );
}

export function getNavigatedCommandPaletteIndex(
  currentIndex: number,
  resultCount: number,
  key: string,
): number | null {
  if (resultCount === 0 || (key !== 'ArrowDown' && key !== 'ArrowUp')) {
    return null;
  }

  const direction = key === 'ArrowDown' ? 1 : -1;
  return (currentIndex + direction + resultCount) % resultCount;
}
