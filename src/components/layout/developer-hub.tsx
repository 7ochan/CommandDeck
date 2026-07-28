'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
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
  width?: number;
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
  width,
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
  const tabRefs = useRef(new Map<DeveloperHubTab, HTMLElement>());

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

  useEffect(() => {
    try {
      localStorage.removeItem('cmd-deck-devhub-closed-tabs');
      localStorage.removeItem('cmd-deck-devhub-pinned-tabs');
    } catch {}
  }, []);

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

    return ordered.filter((tab) => {
      if (tab.id === 'history' && !settings.developerHub.showHistoryTab) {
        return false;
      }
      return true;
    });
  }, [tabOrder, settings.developerHub.showHistoryTab]);

  const visibleIds = visibleTabs.map((t) => t.id);
  if (visibleIds.length > 0 && !visibleIds.includes(activeTab)) {
    setActiveTab(visibleIds[0]);
  }

  const handleDevTabDragStart = (event: DragEvent, tabId: DeveloperHubTab) => {
    event.dataTransfer.setData('text/plain', tabId);
    event.dataTransfer.effectAllowed = 'move';
    setDraggedDevTab(tabId);
  };

  const handleDevTabDragOver = (event: DragEvent, tabId: DeveloperHubTab) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (draggedDevTab && draggedDevTab !== tabId) {
      setDragOverDevTab(tabId);
    }
  };

  const handleDevTabDrop = (event: DragEvent, targetTabId: DeveloperHubTab) => {
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
    event: KeyboardEvent<HTMLElement>,
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
      className="cd-surface flex shrink-0 flex-col overflow-hidden rounded-none border-l border-[var(--border-soft)] bg-[var(--surface-1)] shadow-none"
      style={{ width: width ? `${width}px` : undefined }}
      aria-label="Developer Hub"
    >
      <div className="flex h-9 shrink-0 items-center border-b border-[var(--border-soft)] bg-[var(--surface-2)] shadow-[inset_0_1px_0_rgb(255_255_255_/_3%)]">
        <div
          className="flex h-full min-w-0 flex-1 items-center gap-1 overflow-hidden p-1"
          role="tablist"
          aria-label="Developer Hub tools"
        >
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isDragging = draggedDevTab === tab.id;
            const isDragOver = dragOverDevTab === tab.id;

            return (
              <button
                key={tab.id}
                ref={(element) => {
                  if (element) {
                    tabRefs.current.set(tab.id, element);
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
                className={`group relative flex h-7 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-sm border px-2 text-[11px] font-medium transition-all ${
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
                <Icon name={tab.id === 'deck' ? 'deck' : 'history'} size={13} />
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
              </button>
            );
          })}
        </div>

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
