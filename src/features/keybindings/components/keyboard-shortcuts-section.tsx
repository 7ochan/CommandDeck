'use client';

import { useEffect, useId, useState } from 'react';

import { Icon } from '@/components/ui/icon';
import { useKeybindings } from '../keybindings-provider.tsx';
import { eventToShortcutString, formatShortcutDisplay } from '../registry.ts';
import { ACTION_CATEGORIES } from '../types.ts';

export function KeyboardShortcutsSection() {
  const {
    actions,
    updateShortcut,
    resetShortcut,
    resetAllShortcuts,
    formatShortcut,
    recordingActionId,
    startRecording,
    stopRecording,
    conflictState,
    clearConflictState,
    isMac,
  } = useKeybindings();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [candidateShortcut, setCandidateShortcut] = useState<string | null>(
    null,
  );

  const searchInputId = useId();

  // Handle key capture during Recording mode
  useEffect(() => {
    if (!recordingActionId) {
      return;
    }

    const handleRecordingKeyDown = (event: globalThis.KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'Escape') {
        setCandidateShortcut(null);
        stopRecording();
        return;
      }

      if (event.key === 'Enter') {
        if (candidateShortcut) {
          updateShortcut(recordingActionId, candidateShortcut);
          setCandidateShortcut(null);
          stopRecording();
        }
        return;
      }

      const parsed = eventToShortcutString(event, isMac);
      if (parsed) {
        setCandidateShortcut(parsed);
      }
    };

    window.addEventListener('keydown', handleRecordingKeyDown, true);
    return () =>
      window.removeEventListener('keydown', handleRecordingKeyDown, true);
  }, [
    candidateShortcut,
    isMac,
    recordingActionId,
    stopRecording,
    updateShortcut,
  ]);

  // Filter actions based on search and category
  const filteredActions = actions.filter((action) => {
    const matchesCat =
      selectedCategory === 'All' || action.category === selectedCategory;

    if (!matchesCat) return false;

    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase().trim();
    const formatted = formatShortcut(action.currentShortcut).toLowerCase();
    const defaultFormatted = formatShortcut(
      action.defaultShortcut,
    ).toLowerCase();

    return (
      action.displayName.toLowerCase().includes(q) ||
      action.category.toLowerCase().includes(q) ||
      action.description.toLowerCase().includes(q) ||
      action.currentShortcut.toLowerCase().includes(q) ||
      formatted.includes(q) ||
      defaultFormatted.includes(q)
    );
  });

  const hasAnyCustomizations = actions.some((a) => a.isCustomized);

  return (
    <div className="space-y-4">
      {/* Top Bar: Search & Category Filter */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1">
          <Icon
            name="search"
            size={14}
            className="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            id={searchInputId}
            type="text"
            className="cd-input h-9 w-full pr-3 pl-9 text-[11px]"
            placeholder="Search shortcuts by action name, key combination, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <select
            className="cd-input h-9 px-2.5 text-[11px]"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="All">All Categories</option>
            {ACTION_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="cd-button cd-button--quiet h-9 px-2 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            disabled={!hasAnyCustomizations}
            onClick={resetAllShortcuts}
            title="Reset all shortcuts to defaults"
          >
            <Icon name="history" size={13} />
            <span className="hidden sm:inline">Reset All</span>
          </button>
        </div>
      </div>

      {/* Action Table / List */}
      <div className="divide-y divide-[var(--border-soft)] rounded-xl border border-[var(--border-soft)] bg-[var(--surface-1)]">
        {filteredActions.length === 0 ? (
          <div className="p-8 text-center text-[11px] text-[var(--text-muted)]">
            No shortcuts matching &quot;{searchQuery}&quot;
          </div>
        ) : (
          filteredActions.map((action) => {
            const isRecording = recordingActionId === action.id;

            return (
              <div
                key={action.id}
                className={`flex flex-col gap-2 p-3.5 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                  isRecording
                    ? 'bg-[var(--accent-soft)]/20'
                    : 'hover:bg-[var(--surface-2)]/40'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-medium text-[var(--text-primary)]">
                      {action.displayName}
                    </span>
                    <span className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-muted)]">
                      {action.category}
                    </span>
                    {action.isCustomized && (
                      <span className="rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--accent)]">
                        Customized
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                    {action.description}
                  </p>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                  {/* Shortcut Display / Recording Display */}
                  {isRecording ? (
                    <div className="flex items-center gap-2">
                      <span className="animate-pulse text-[10px] font-medium text-[var(--accent)]">
                        {candidateShortcut
                          ? `Recorded: ${formatShortcutDisplay(candidateShortcut, isMac)}`
                          : 'Recording... Press key combination'}
                      </span>
                      <kbd className="cd-kbd text-[10px]">
                        {candidateShortcut
                          ? formatShortcutDisplay(candidateShortcut, isMac)
                          : 'Press keys...'}
                      </kbd>
                    </div>
                  ) : (
                    <kbd className="cd-kbd text-[11px]">
                      {action.currentShortcut
                        ? formatShortcut(action.currentShortcut)
                        : 'Unassigned'}
                    </kbd>
                  )}

                  {/* Actions: Edit / Cancel / Confirm / Reset */}
                  <div className="flex items-center gap-1.5">
                    {isRecording ? (
                      <>
                        <button
                          type="button"
                          className="cd-button cd-button--primary h-7 px-2 text-[10px]"
                          disabled={!candidateShortcut}
                          onClick={() => {
                            if (candidateShortcut) {
                              updateShortcut(action.id, candidateShortcut);
                              setCandidateShortcut(null);
                              stopRecording();
                            }
                          }}
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          className="cd-button h-7 px-2 text-[10px]"
                          onClick={() => {
                            setCandidateShortcut(null);
                            stopRecording();
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="cd-button h-7.5 px-2 text-[10px]"
                          onClick={() => startRecording(action.id)}
                          title="Edit shortcut"
                        >
                          <Icon name="edit" size={12} />
                          Edit
                        </button>
                        <button
                          type="button"
                          className="cd-button cd-button--quiet h-7.5 px-2 text-[10px] text-[var(--text-muted)] disabled:opacity-30"
                          disabled={!action.isCustomized}
                          onClick={() => resetShortcut(action.id)}
                          title="Reset to default shortcut"
                        >
                          Reset
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Conflict Modal / Dialog */}
      {conflictState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="conflict-title"
        >
          <div className="cd-modal w-full max-w-md space-y-4 rounded-2xl border border-[var(--border-strong)] bg-[var(--canvas-raised)] p-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="cd-clay-tile flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--danger)]/15 text-[var(--danger)]">
                <Icon name="alert" size={16} />
              </span>
              <div>
                <h3
                  id="conflict-title"
                  className="text-[14px] font-semibold text-[var(--text-primary)]"
                >
                  Shortcut Conflict
                </h3>
                <p className="text-[10px] text-[var(--text-muted)]">
                  Keybinding already in use
                </p>
              </div>
            </div>

            <p className="text-[11px] leading-5 text-[var(--text-secondary)]">
              This shortcut{' '}
              <kbd className="cd-kbd text-[10px]">
                {formatShortcutDisplay(conflictState.shortcut, isMac)}
              </kbd>{' '}
              is already assigned to &apos;
              <strong className="text-[var(--text-primary)]">
                {conflictState.conflictingActionName}
              </strong>
              &apos;.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                className="cd-button h-8 px-3 text-[11px]"
                onClick={clearConflictState}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cd-button cd-button--primary h-8 px-3 text-[11px]"
                onClick={() => {
                  updateShortcut(
                    conflictState.pendingActionId,
                    conflictState.pendingShortcut,
                    true,
                  );
                }}
              >
                Replace Existing Binding
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
