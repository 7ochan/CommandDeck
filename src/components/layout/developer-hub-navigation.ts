import type { DeveloperHubTab } from './developer-hub-tabs';

const PENDING_DEVELOPER_HUB_TAB_KEY = 'commanddeck:developer-hub-tab';
const OPEN_DEVELOPER_HUB_TAB_EVENT = 'commanddeck:open-developer-hub-tab';

type HubNavigationStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function requestDeveloperHubTab(
  tab: DeveloperHubTab,
  storage?: HubNavigationStorage,
): void {
  try {
    resolveStorage(storage)?.setItem(PENDING_DEVELOPER_HUB_TAB_KEY, tab);
  } catch {
    // The same-page event still opens the Hub if storage is unavailable.
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<DeveloperHubTab>(OPEN_DEVELOPER_HUB_TAB_EVENT, {
        detail: tab,
      }),
    );
  }
}

export function consumePendingDeveloperHubTab(
  storage?: HubNavigationStorage,
): DeveloperHubTab | null {
  const resolvedStorage = resolveStorage(storage);

  try {
    const value = resolvedStorage?.getItem(PENDING_DEVELOPER_HUB_TAB_KEY);
    resolvedStorage?.removeItem(PENDING_DEVELOPER_HUB_TAB_KEY);
    return isDeveloperHubTab(value) ? value : null;
  } catch {
    return null;
  }
}

export function subscribeToDeveloperHubTabRequests(
  listener: (tab: DeveloperHubTab) => void,
): () => void {
  const handleRequest = (event: Event) => {
    const tab = (event as CustomEvent<unknown>).detail;

    if (isDeveloperHubTab(tab)) {
      listener(tab);
    }
  };

  window.addEventListener(OPEN_DEVELOPER_HUB_TAB_EVENT, handleRequest);
  return () =>
    window.removeEventListener(OPEN_DEVELOPER_HUB_TAB_EVENT, handleRequest);
}

function isDeveloperHubTab(value: unknown): value is DeveloperHubTab {
  return value === 'deck' || value === 'history';
}

function resolveStorage(
  storage?: HubNavigationStorage,
): HubNavigationStorage | null {
  if (storage) {
    return storage;
  }

  return typeof window === 'undefined' ? null : window.sessionStorage;
}
