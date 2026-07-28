'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';

import { AddDeckItemDialog } from '@/features/command-deck/components/add-deck-item-dialog';
import { CommandDeckSection } from '@/features/command-deck/components/command-deck-section';
import { CommandHistorySection } from '@/features/command-history/components/command-history-section';
import { Icon } from '@/components/ui/icon';
import { useSettings } from '@/features/settings/settings-provider';
import type {
  CommandDeckItem,
  CommandDeckItemUpdate,
  CommandHistoryEntry,
  CommandHistoryQuery,
  CommandHistoryStatus,
} from '@/shared/types';

import {
  DEVELOPER_HUB_TABS,
  getDeveloperHubTabForKey,
  type DeveloperHubTab,
} from './developer-hub-tabs';
import {
  consumePendingDeveloperHubTab,
  subscribeToDeveloperHubTabRequests,
} from './developer-hub-navigation';

type DeveloperHubProps = {
  deckItems: CommandDeckItem[];
  isDeckLoading: boolean;
  deckLoadError: string | null;
  historyEntries: CommandHistoryEntry[];
  selectedHistoryEntryId: string | null;
  historyQuery: CommandHistoryQuery;
  isHistoryLoading: boolean;
  isHistorySearching: boolean;
  historyLoadError: string | null;
  onHistorySearchTermChange: (searchTerm: string) => void;
  onToggleHistoryStatus: (status: CommandHistoryStatus) => void;
  onClearHistoryQuery: () => void;
  onSelectHistoryEntry: (commandId: string) => void;
  onClearHistorySelection: () => void;
  onAddHistoryToDeck: (historyId: string) => Promise<void>;
  onCreateDeckItem?: (
    displayName: string,
    command: string,
    description?: string | null,
  ) => Promise<void>;
  onUpdateDeckItem: (
    deckItemId: string,
    update: CommandDeckItemUpdate,
  ) => Promise<void>;
  onRemoveDeckItem: (deckItemId: string) => Promise<void>;
  onRunCommand: (command: string) => boolean;
};

export function DeveloperHub({
  deckItems,
  isDeckLoading,
  deckLoadError,
  historyEntries,
  selectedHistoryEntryId,
  historyQuery,
  isHistoryLoading,
  isHistorySearching,
  historyLoadError,
  onHistorySearchTermChange,
  onToggleHistoryStatus,
  onClearHistoryQuery,
  onSelectHistoryEntry,
  onClearHistorySelection,
  onAddHistoryToDeck,
  onCreateDeckItem,
  onUpdateDeckItem,
  onRemoveDeckItem,
  onRunCommand,
}: DeveloperHubProps) {
  const {
    settings,
    state: settingsState,
    updateState: updateSettingsState,
  } = useSettings();
  const [activeTab, setActiveTab] = useState<DeveloperHubTab>(() =>
    settings.developerHub.rememberLastSelectedTab &&
    settingsState.lastDeveloperHubTab
      ? settingsState.lastDeveloperHubTab
      : 'deck',
  );
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const tabRefs = useRef(new Map<DeveloperHubTab, HTMLButtonElement>());

  const [tabOrder, setTabOrder] = useState<DeveloperHubTab[]>(() => {
    if (typeof window === 'undefined')
      return DEVELOPER_HUB_TABS.map((t) => t.id);
    try {
      const stored = localStorage.getItem('cmd-deck-devhub-tab-order');
      return stored ? JSON.parse(stored) : DEVELOPER_HUB_TABS.map((t) => t.id);
    } catch {
      return DEVELOPER_HUB_TABS.map((t) => t.id);
    }
  });

  const [pinnedTabs, setPinnedTabs] = useState<DeveloperHubTab[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('cmd-deck-devhub-pinned-tabs');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [closedTabs, setClosedTabs] = useState<DeveloperHubTab[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('cmd-deck-devhub-closed-tabs');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [draggedDevTab, setDraggedDevTab] = useState<DeveloperHubTab | null>(
    null,
  );
  const [dragOverDevTab, setDragOverDevTab] = useState<DeveloperHubTab | null>(
    null,
  );

  const deckHistoryIds = useMemo(
    () =>
      new Set(
        deckItems.flatMap(({ sourceHistoryId }) =>
          sourceHistoryId ? [sourceHistoryId] : [],
        ),
      ),
    [deckItems],
  );
  const tabCounts: Record<DeveloperHubTab, number> = {
    deck: deckItems.length,
    history: historyEntries.length,
  };

  const selectTab = useCallback(
    (tab: DeveloperHubTab) => {
      setActiveTab(tab);

      if (
        settings.developerHub.rememberLastSelectedTab &&
        settingsState.lastDeveloperHubTab !== tab
      ) {
        updateSettingsState({ lastDeveloperHubTab: tab });
      }
    },
    [
      settings.developerHub.rememberLastSelectedTab,
      settingsState.lastDeveloperHubTab,
      updateSettingsState,
    ],
  );

  const togglePinTab = (tabId: DeveloperHubTab, event: MouseEvent) => {
    event.stopPropagation();
    setPinnedTabs((prev) => {
      const next = prev.includes(tabId)
        ? prev.filter((id) => id !== tabId)
        : [...prev, tabId];
      try {
        localStorage.setItem(
          'cmd-deck-devhub-pinned-tabs',
          JSON.stringify(next),
        );
      } catch {}
      return next;
    });
  };

  const closeTab = (tabId: DeveloperHubTab, event: MouseEvent) => {
    event.stopPropagation();
    setClosedTabs((prev) => {
      if (prev.includes(tabId)) return prev;
      const next = [...prev, tabId];
      try {
        localStorage.setItem(
          'cmd-deck-devhub-closed-tabs',
          JSON.stringify(next),
        );
      } catch {}
      return next;
    });
  };

  const restoreTab = (tabId: DeveloperHubTab) => {
    setClosedTabs((prev) => {
      const next = prev.filter((id) => id !== tabId);
      try {
        localStorage.setItem(
          'cmd-deck-devhub-closed-tabs',
          JSON.stringify(next),
        );
      } catch {}
      return next;
    });
    selectTab(tabId);
  };

  const visibleTabs = useMemo(() => {
    const map = new Map(DEVELOPER_HUB_TABS.map((t) => [t.id, t]));
    const ordered: (typeof DEVELOPER_HUB_TABS)[number][] = [];

    tabOrder.forEach((id) => {
      const tab = map.get(id);
      if (tab) {
        ordered.push(tab);
        map.delete(id);
      }
    });

    map.forEach((tab) => ordered.push(tab));

    const filtered = ordered.filter((tab) => {
      if (tab.id === 'history' && !settings.developerHub.showHistoryTab) {
        return false;
      }
      if (closedTabs.includes(tab.id)) {
        return false;
      }
      return true;
    });

    const pinned = filtered.filter((t) => pinnedTabs.includes(t.id));
    const unpinned = filtered.filter((t) => !pinnedTabs.includes(t.id));

    return [...pinned, ...unpinned];
  }, [tabOrder, settings.developerHub.showHistoryTab, closedTabs, pinnedTabs]);

  useEffect(() => {
    const visibleIds = visibleTabs.map((t) => t.id);
    if (visibleIds.length > 0 && !visibleIds.includes(activeTab)) {
      setActiveTab(visibleIds[0]);
    }
  }, [visibleTabs, activeTab]);

  const handleDevTabDragStart = (
    event: DragEvent,
    tabId: DeveloperHubTab,
  ) => {
    event.dataTransfer.setData('text/plain', tabId);
    event.dataTransfer.effectAllowed = 'move';
    setDraggedDevTab(tabId);
  };

  const handleDevTabDragOver = (
    event: DragEvent,
    tabId: DeveloperHubTab,
  ) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (draggedDevTab && draggedDevTab !== tabId) {
      setDragOverDevTab(tabId);
    }
  };

  const handleDevTabDrop = (
    event: DragEvent,
    targetTabId: DeveloperHubTab,
  ) => {
    event.preventDefault();
    const sourceId =
      draggedDevTab ||
      (event.dataTransfer.getData('text/plain') as DeveloperHubTab);
    if (!sourceId || sourceId === targetTabId) {
      setDraggedDevTab(null);
      setDragOverDevTab(null);
      return;
    }

    const currentIds = visibleTabs.map((t) => t.id);
    const sourceIdx = currentIds.indexOf(sourceId);
    const targetIdx = currentIds.indexOf(targetTabId);

    if (sourceIdx !== -1 && targetIdx !== -1) {
      const nextOrder = [...currentIds];
      const [moved] = nextOrder.splice(sourceIdx, 1);
      nextOrder.splice(targetIdx, 0, moved);
      setTabOrder(nextOrder);
      try {
        localStorage.setItem(
          'cmd-deck-devhub-tab-order',
          JSON.stringify(nextOrder),
        );
      } catch {}
    }

    setDraggedDevTab(null);
    setDragOverDevTab(null);
  };

  if (!settings.developerHub.showHistoryTab && activeTab === 'history') {
    setActiveTab('deck');
  }

  useEffect(() => {
    let subscribed = true;
    const openRequestedTab = (tab: DeveloperHubTab) => {
      consumePendingDeveloperHubTab();
      selectTab(tab);
    };
    const pendingTab = consumePendingDeveloperHubTab();

    if (pendingTab) {
      queueMicrotask(() => {
        if (subscribed) {
          selectTab(pendingTab);
        }
      });
    }

    const unsubscribe = subscribeToDeveloperHubTabRequests(openRequestedTab);
    return () => {
      subscribed = false;
      unsubscribe();
    };
  }, [selectTab]);

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentTab: DeveloperHubTab,
  ) => {
    const targetTab = getDeveloperHubTabForKey(currentTab, event.key);

    if (!targetTab) {
      return;
    }

    event.preventDefault();
    selectTab(targetTab);
    tabRefs.current.get(targetTab)?.focus();
  };

  return (
    <aside
      className="cd-surface flex w-64 shrink-0 flex-col overflow-hidden rounded-[15px]"
      aria-label="Developer Hub"
    >
      <div className="flex h-12 shrink-0 items-center border-b border-[var(--border-soft)] bg-[var(--surface-2)] shadow-[inset_0_1px_0_rgb(255_255_255_/_3%)]">
        <div
          className="cd-scrollbar flex h-full min-w-0 flex-1 items-center gap-1 overflow-x-auto p-1.5"
          role="tablist"
          aria-label="Developer Hub tools"
        >
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isPinned = pinnedTabs.includes(tab.id);
            const isDragging = draggedDevTab === tab.id;
            const isDragOver = dragOverDevTab === tab.id;

            return (
              <button
                key={tab.id}
                ref={(button) => {
                  if (button) {
                    tabRefs.current.set(tab.id, button);
                  } else {
                    tabRefs.current.delete(tab.id);
                  }
                }}
                id={`developer-hub-tab-${tab.id}`}
                type="button"
                role="tab"
                draggable
                onDragStart={(e) => handleDevTabDragStart(e, tab.id)}
                onDragOver={(e) => handleDevTabDragOver(e, tab.id)}
                onDragLeave={() => setDragOverDevTab(null)}
                onDrop={(e) => handleDevTabDrop(e, tab.id)}
                onDragEnd={() => {
                  setDraggedDevTab(null);
                  setDragOverDevTab(null);
                }}
                aria-selected={isActive}
                aria-controls={`developer-hub-panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                className={`group relative flex h-8 min-w-0 flex-1 items-center justify-between gap-1 rounded-md border px-2 text-[11px] font-medium transition-all cursor-grab active:cursor-grabbing ${
                  isDragging ? 'opacity-40' : ''
                } ${
                  isDragOver
                    ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]'
                    : isActive
                      ? 'cd-segment-active'
                      : 'border-transparent text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-secondary)]'
                }`}
                onClick={() => selectTab(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <Icon
                    name={tab.id === 'deck' ? 'deck' : 'history'}
                    size={13}
                  />
                  <span className="truncate">{tab.label}</span>
                  <span
                    className={`rounded px-1 py-0.5 font-mono text-[9px] ${
                      isActive
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'bg-[var(--surface-2)] text-[var(--text-subtle)]'
                    }`}
                  >
                    {tabCounts[tab.id]}
                  </span>
                </div>

                {/* Hover / Pin & Close action icons */}
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={(e) => togglePinTab(tab.id, e)}
                    className={`flex size-4 items-center justify-center rounded transition-colors ${
                      isPinned
                        ? 'text-[var(--accent)] opacity-100'
                        : 'text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--text-primary)]'
                    }`}
                    title={isPinned ? 'Unpin tab' : 'Pin tab'}
                    aria-label={isPinned ? 'Unpin tab' : 'Pin tab'}
                  >
                    <Icon name="pin" size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => closeTab(tab.id, e)}
                    className="flex size-4 items-center justify-center rounded text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--danger)]"
                    title="Close tab"
                    aria-label="Close tab"
                  >
                    <Icon name="x" size={11} />
                  </button>
                </div>
              </button>
            );
          })}
        </div>

        {closedTabs.length > 0 && (
          <button
            type="button"
            className="cd-icon-button mr-1 size-7 shrink-0 border-transparent text-[var(--text-muted)] hover:text-[var(--accent)]"
            aria-label="Restore closed tab"
            title={`Restore closed tab (${closedTabs.join(', ')})`}
            onClick={() => restoreTab(closedTabs[0])}
          >
            <Icon name="plus" size={15} />
          </button>
        )}

        {onCreateDeckItem && (
          <button
            type="button"
            className="cd-icon-button mr-1.5 size-7 shrink-0 border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            aria-label="Add new Deck shortcut"
            title="Add new Deck shortcut"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Icon name="plus" size={15} />
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        {visibleTabs.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-4 text-center">
            <p className="text-[12px] text-[var(--text-muted)]">
              All Developer Hub tabs are closed.
            </p>
            <button
              type="button"
              onClick={() => setClosedTabs([])}
              className="mt-2 font-mono text-[11px] text-[var(--accent)] hover:underline"
            >
              Restore all tabs
            </button>
          </div>
        ) : (
          <>
            <DeveloperHubPanel tab="deck" activeTab={activeTab}>
              <CommandDeckSection
                items={deckItems}
                isLoading={isDeckLoading}
                loadError={deckLoadError}
                onRun={onRunCommand}
                onUpdate={onUpdateDeckItem}
                onRemove={onRemoveDeckItem}
              />
            </DeveloperHubPanel>

            <DeveloperHubPanel tab="history" activeTab={activeTab}>
              <CommandHistorySection
                entries={historyEntries}
                selectedEntryId={selectedHistoryEntryId}
                deckHistoryIds={deckHistoryIds}
                query={historyQuery}
                isLoading={isHistoryLoading}
                isSearching={isHistorySearching}
                loadError={historyLoadError}
                onSearchTermChange={onHistorySearchTermChange}
                onToggleStatus={onToggleHistoryStatus}
                onClearQuery={onClearHistoryQuery}
                onSelectEntry={onSelectHistoryEntry}
                onClearSelection={onClearHistorySelection}
                onRunAgain={onRunCommand}
                onAddToDeck={onAddHistoryToDeck}
              />
            </DeveloperHubPanel>
          </>
        )}
      </div>

      {onCreateDeckItem && (
        <AddDeckItemDialog
          isOpen={isAddDialogOpen}
          onCancel={() => setIsAddDialogOpen(false)}
          onSave={onCreateDeckItem}
        />
      )}
    </aside>
  );
}

function DeveloperHubPanel({
  tab,
  activeTab,
  children,
}: {
  tab: DeveloperHubTab;
  activeTab: DeveloperHubTab;
  children: ReactNode;
}) {
  const isActive = tab === activeTab;

  return (
    <div
      id={`developer-hub-panel-${tab}`}
      role="tabpanel"
      aria-labelledby={`developer-hub-tab-${tab}`}
      hidden={!isActive}
      inert={!isActive}
      className={isActive ? 'flex min-h-0 flex-1' : 'hidden'}
    >
      {children}
    </div>
  );
}
