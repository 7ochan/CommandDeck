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
  const [activeTab, setActiveTab] = useState<DeveloperHubTab>('deck');
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

  const selectTab = useCallback((tab: DeveloperHubTab) => {
    setActiveTab(tab);
    setIsMobileExpanded(true);
  }, []);

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
      className={`flex shrink-0 flex-col overflow-hidden rounded-xl border border-white/8 bg-[#080d14] shadow-[0_18px_55px_rgba(0,0,0,0.18)] transition-[height] duration-200 motion-reduce:transition-none lg:h-auto lg:min-h-0 lg:w-[clamp(18rem,24vw,22rem)] ${
        isMobileExpanded ? 'h-[min(38%,22rem)] min-h-40' : 'h-11'
      }`}
      aria-label="Developer Hub"
    >
      <div className="flex h-11 shrink-0 items-center border-b border-white/7 bg-white/[0.018]">
        <div className="flex h-full shrink-0 items-center border-r border-white/7 px-3">
          <span className="font-mono text-[9px] font-semibold tracking-[0.16em] text-slate-500 uppercase">
            Dev Hub
          </span>
        </div>

        <div
          className="flex h-full min-w-0 flex-1 items-center gap-0.5 p-1"
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
                className={`flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2 font-mono text-[10px] transition-colors focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:outline-none ${
                  isActive
                    ? 'bg-white/7 text-slate-200'
                    : 'text-slate-500 hover:bg-white/4 hover:text-slate-300'
                }`}
                onClick={() => selectTab(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[8px] ${
                    isActive
                      ? 'bg-cyan-300/10 text-cyan-100/65'
                      : 'bg-white/4 text-slate-600'
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
          className="mr-1 flex size-8 shrink-0 items-center justify-center rounded-md text-[10px] text-slate-500 hover:bg-white/5 hover:text-slate-300 focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:outline-none lg:hidden"
          aria-expanded={isMobileExpanded}
          aria-label={
            isMobileExpanded ? 'Collapse Developer Hub' : 'Expand Developer Hub'
          }
          onClick={() => setIsMobileExpanded((current) => !current)}
        >
          <span aria-hidden="true">{isMobileExpanded ? '⌄' : '⌃'}</span>
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
