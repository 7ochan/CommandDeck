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

import { buildCommandPaletteIndex, searchCommandPalette } from '../search';
import { getNavigatedCommandPaletteIndex } from '../keyboard';
import type { RegisteredCommandPaletteAction } from '../types';

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
      className="m-auto w-[min(42rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-cyan-300/15 bg-[#090e16] p-0 text-slate-200 shadow-[0_30px_100px_rgba(0,0,0,0.72)] backdrop:bg-[#020409]/75 backdrop:backdrop-blur-[2px]"
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
      <div className="border-b border-white/8 p-3">
        <div className="flex items-center gap-3 rounded-xl bg-black/20 px-3">
          <span
            className="font-mono text-sm text-cyan-300/65"
            aria-hidden="true"
          >
            &gt;
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
            className="h-11 min-w-0 flex-1 bg-transparent font-mono text-[13px] text-slate-100 outline-none placeholder:text-slate-600"
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
          />
          <kbd className="rounded-md border border-white/8 bg-white/3 px-1.5 py-1 font-mono text-[9px] text-slate-600">
            ESC
          </kbd>
        </div>
      </div>

      <div
        ref={resultListRef}
        id="command-palette-results"
        className="command-palette-scrollbar max-h-[min(28rem,60vh)] min-h-28 overflow-y-auto p-2"
        role="listbox"
        aria-label="Command Palette results"
      >
        {results.length === 0 ? (
          <div className="flex min-h-28 items-center justify-center px-6 text-center">
            <p className="text-[11px] text-slate-500">
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
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:outline-none ${
                  isSelected
                    ? 'bg-cyan-300/[0.085] text-slate-100'
                    : 'text-slate-300 hover:bg-white/[0.035]'
                } ${action.disabled ? 'cursor-not-allowed opacity-45' : ''}`}
                onMouseMove={() => setSelectedIndex(resultIndex)}
                onClick={() => execute(action)}
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-md font-mono text-[10px] ${ACTION_TONE_CLASSES[action.tone ?? 'neutral']}`}
                  aria-hidden="true"
                >
                  {action.icon ?? '⌘'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[11px]">
                    {action.label}
                  </span>
                  {action.description && (
                    <span className="mt-0.5 block truncate text-[9px] text-slate-600">
                      {action.description}
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-[8px] tracking-wide text-slate-600 uppercase">
                  {action.group}
                </span>
              </button>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between border-t border-white/7 px-4 py-2 font-mono text-[8px] text-slate-600">
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
  neutral: 'bg-white/5 text-slate-400',
  cyan: 'bg-cyan-300/8 text-cyan-200/70',
  green: 'bg-emerald-300/8 text-emerald-200/65',
  violet: 'bg-violet-300/8 text-violet-200/65',
};
