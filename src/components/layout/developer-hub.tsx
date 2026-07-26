'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

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
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const tabRefs = useRef(new Map<DeveloperHubTab, HTMLButtonElement>());
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
      setIsMobileExpanded(true);

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

  useEffect(() => {
    if (
      settings.developerHub.rememberLastSelectedTab &&
      settingsState.lastDeveloperHubTab !== activeTab
    ) {
      updateSettingsState({ lastDeveloperHubTab: activeTab });
    }
  }, [
    activeTab,
    settings.developerHub.rememberLastSelectedTab,
    settingsState.lastDeveloperHubTab,
    updateSettingsState,
  ]);

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
      className={`cd-surface flex shrink-0 flex-col overflow-hidden rounded-[15px] transition-[height] duration-150 motion-reduce:transition-none w-64 lg:h-auto lg:min-h-0 lg:w-64 ${
        isMobileExpanded ? 'h-[min(42%,24rem)] min-h-44' : 'h-12'
      }`}
      aria-label="Developer Hub"
    >
      <div className="flex h-12 shrink-0 items-center border-b border-[var(--border-soft)] bg-[var(--surface-2)] shadow-[inset_0_1px_0_rgb(255_255_255_/_3%)]">

        <div
          className="flex h-full min-w-0 flex-1 items-center gap-1 p-1.5"
          role="tablist"
          aria-label="Developer Hub tools"
        >
          {DEVELOPER_HUB_TABS.map((tab) => {
            const isActive = activeTab === tab.id;

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
                aria-selected={isActive}
                aria-controls={`developer-hub-panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                className={`flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition-colors ${
                  isActive
                    ? 'cd-segment-active'
                    : 'border-transparent text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-secondary)]'
                }`}
                onClick={() => selectTab(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
              >
                <Icon name={tab.id === 'deck' ? 'deck' : 'history'} size={14} />
                <span>{tab.label}</span>
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[9px] ${
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

        <button
          type="button"
          className="cd-icon-button mr-1.5 shrink-0 border-transparent text-[var(--text-muted)] lg:hidden"
          aria-expanded={isMobileExpanded}
          aria-label={
            isMobileExpanded ? 'Collapse Developer Hub' : 'Expand Developer Hub'
          }
          onClick={() => setIsMobileExpanded((current) => !current)}
        >
          <Icon
            name={isMobileExpanded ? 'chevron-down' : 'chevron-up'}
            size={15}
          />
        </button>
      </div>

      <div
        className={`${isMobileExpanded ? 'flex' : 'hidden'} min-h-0 flex-1 lg:flex`}
      >
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
