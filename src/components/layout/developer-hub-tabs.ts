export const DEVELOPER_HUB_TABS = [
  { id: 'deck', label: 'Deck' },
  { id: 'history', label: 'History' },
] as const;

export type DeveloperHubTab = (typeof DEVELOPER_HUB_TABS)[number]['id'];

export function getDeveloperHubTabForKey(
  currentTab: DeveloperHubTab,
  key: string,
): DeveloperHubTab | null {
  const currentIndex = DEVELOPER_HUB_TABS.findIndex(
    ({ id }) => id === currentTab,
  );

  if (key === 'Home') {
    return DEVELOPER_HUB_TABS[0].id;
  }

  if (key === 'End') {
    return DEVELOPER_HUB_TABS.at(-1)?.id ?? null;
  }

  if (key !== 'ArrowLeft' && key !== 'ArrowRight') {
    return null;
  }

  const direction = key === 'ArrowRight' ? 1 : -1;
  const targetIndex =
    (currentIndex + direction + DEVELOPER_HUB_TABS.length) %
    DEVELOPER_HUB_TABS.length;
  return DEVELOPER_HUB_TABS[targetIndex]?.id ?? null;
}
