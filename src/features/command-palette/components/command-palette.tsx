'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';

import { Icon, type IconName } from '@/components/ui/icon';
import { buildCommandPaletteIndex, searchCommandPalette } from '../search.ts';
import { getNavigatedCommandPaletteIndex } from '../keyboard.ts';
import type { RegisteredCommandPaletteAction } from '../types.ts';

type CommandPaletteProps = {
  actions: RegisteredCommandPaletteAction[];
  isOpen: boolean;
  focusRequest: number;
  onRequestClose: () => void;
};

export function CommandPalette({
  actions,
  isOpen,
  focusRequest,
  onRequestClose,
}: CommandPaletteProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultListRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const index = useMemo(() => buildCommandPaletteIndex(actions), [actions]);
  const results = useMemo(
    () => searchCommandPalette(index, query),
    [index, query],
  );
  const safeSelectedIndex = results.length
    ? Math.min(selectedIndex, results.length - 1)
    : 0;
  const selectedAction = results[safeSelectedIndex];

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }

      const focusFrame = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(focusFrame);
    } else if (dialog.open) {
      dialog.close();
    }
  }, [focusRequest, isOpen]);

  useEffect(() => {
    const selectedResult = resultListRef.current?.querySelector<HTMLElement>(
      `[data-palette-index="${safeSelectedIndex}"]`,
    );
    selectedResult?.scrollIntoView({ block: 'nearest' });
  }, [safeSelectedIndex]);

  const requestClose = () => {
    setQuery('');
    setSelectedIndex(0);
    onRequestClose();
  };

  const execute = (action: RegisteredCommandPaletteAction | undefined) => {
    if (!action || action.disabled) {
      return;
    }

    requestClose();
    queueMicrotask(() => {
      void Promise.resolve(action.execute()).catch(() => undefined);
    });
  };

  const moveSelection = (direction: 1 | -1) => {
    const targetIndex = getNavigatedCommandPaletteIndex(
      safeSelectedIndex,
      results.length,
      direction === 1 ? 'ArrowDown' : 'ArrowUp',
    );

    if (targetIndex !== null) {
      setSelectedIndex(targetIndex);
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.currentTarget.value);
    setSelectedIndex(0);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveSelection(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveSelection(-1);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      execute(selectedAction);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      requestClose();
    }
  };

  const closeFromBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) {
      requestClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="cd-dialog w-[min(42rem,calc(100vw-1.5rem))] p-0"
      data-command-palette="true"
      aria-label="Command Palette"
      onClick={closeFromBackdrop}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClose={() => {
        if (isOpen) {
          requestClose();
        }
      }}
    >
      <div className="border-b border-[var(--border-soft)] p-3">
        <div className="cd-inset-tray cd-palette-search flex items-center gap-2.5 rounded-md px-3">
          <span className="text-[var(--accent)]" aria-hidden="true">
            <Icon name="search" size={16} />
          </span>
          <input
            ref={inputRef}
            type="search"
            autoComplete="off"
            spellCheck={false}
            value={query}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-results"
            aria-activedescendant={
              selectedAction
                ? `command-palette-action-${selectedAction.registryId}`
                : undefined
            }
            placeholder="Search commands, history, workspaces…"
            className="h-10 min-w-0 flex-1 bg-transparent font-mono text-[12px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-subtle)]"
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
          />
          <kbd className="cd-kbd">ESC</kbd>
        </div>
      </div>

      <div
        ref={resultListRef}
        id="command-palette-results"
        className="command-palette-scrollbar max-h-[min(30rem,62vh)] min-h-32 overflow-y-auto p-2"
        role="listbox"
        aria-label="Command Palette results"
      >
        {results.length === 0 ? (
          <div className="flex min-h-28 items-center justify-center px-6 text-center">
            <p className="text-[12px] text-[var(--text-muted)]">
              No commands match “{query.trim()}”.
            </p>
          </div>
        ) : (
          results.map((action, resultIndex) => {
            const isSelected = resultIndex === safeSelectedIndex;

            return (
              <button
                key={action.registryId}
                id={`command-palette-action-${action.registryId}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                aria-disabled={action.disabled || undefined}
                data-palette-index={resultIndex}
                className={`flex w-full items-center gap-2.5 rounded-sm border px-2.5 py-2 text-left transition-colors ${
                  isSelected
                    ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--text-primary)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'
                } ${action.disabled ? 'cursor-not-allowed opacity-45' : ''}`}
                onMouseMove={() => setSelectedIndex(resultIndex)}
                onClick={() => execute(action)}
              >
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-md ${ACTION_TONE_CLASSES[action.tone ?? 'neutral']}`}
                  aria-hidden="true"
                >
                  <Icon name={getPaletteIcon(action)} size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium">
                    {action.label}
                  </span>
                  {action.description && (
                    <span className="mt-0.5 block truncate text-[10px] text-[var(--text-muted)]">
                      {action.description}
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-[9px] tracking-wide text-[var(--text-muted)] uppercase">
                  {action.group}
                </span>
              </button>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[var(--border-soft)] bg-[var(--canvas-raised)] px-4 py-2.5 font-mono text-[10px] text-[var(--text-muted)]">
        <span>{results.length} results</span>
        <span>↑↓ Navigate · Enter Run</span>
      </div>
    </dialog>
  );
}

const ACTION_TONE_CLASSES: Record<
  NonNullable<RegisteredCommandPaletteAction['tone']>,
  string
> = {
  neutral: 'bg-[var(--surface-3)] text-[var(--text-muted)]',
  cyan: 'bg-[var(--info-soft)] text-[var(--info)]',
  green: 'bg-[var(--accent-soft)] text-[var(--accent)]',
  violet: 'bg-[rgb(195_155_232_/_10%)] text-[#c39be8]',
};

function getPaletteIcon(action: RegisteredCommandPaletteAction): IconName {
  if (action.group === 'Workspaces') return 'workspace';
  if (action.group === 'History') return 'history';
  if (action.group === 'Deck') return 'deck';
  if (action.group === 'Templates') return 'command';
  if (action.label.toLowerCase().includes('settings')) return 'settings';
  if (action.label.toLowerCase().includes('timeline')) return 'timeline';
  if (action.label.toLowerCase().includes('deck')) return 'deck';
  if (action.label.toLowerCase().includes('history')) return 'history';
  return 'terminal';
}
