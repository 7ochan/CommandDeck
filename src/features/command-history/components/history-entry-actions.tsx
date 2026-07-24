'use client';

import { useState } from 'react';

import { copyCommandText } from '../clipboard';
import type { CommandHistoryEntry } from '../types';

type HistoryEntryActionsProps = {
  entry: CommandHistoryEntry;
  panelId: string;
  isInDeck: boolean;
  onRunAgain: (command: string) => boolean;
  onAddToDeck: (historyId: string) => Promise<void>;
};

type PendingAction = 'copy' | 'add';

export function HistoryEntryActions({
  entry,
  panelId,
  isInDeck,
  onRunAgain,
  onAddToDeck,
}: HistoryEntryActionsProps) {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const runAgain = () => {
    setStatusMessage(
      onRunAgain(entry.command)
        ? 'Command sent to the active terminal.'
        : 'The active terminal is not connected.',
    );
  };

  const copyCommand = async () => {
    setPendingAction('copy');
    setStatusMessage(null);

    try {
      await copyCommandText(entry.command);
      setStatusMessage('Command copied.');
    } catch {
      setStatusMessage('Unable to access the clipboard.');
    } finally {
      setPendingAction(null);
    }
  };

  const addToDeck = async () => {
    setPendingAction('add');
    setStatusMessage(null);

    try {
      await onAddToDeck(entry.commandId);
      setStatusMessage('Added to the Command Deck.');
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'Unable to add to the Deck.',
      );
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div
      id={panelId}
      className="border-t border-white/6 px-2.5 py-2.5"
      aria-label="Command History actions"
    >
      <div className="grid grid-cols-3 gap-1.5">
        <ActionButton icon="▶" label="Run Again" onClick={runAgain} />
        <ActionButton
          icon="⎘"
          label={pendingAction === 'copy' ? 'Copying…' : 'Copy'}
          disabled={pendingAction !== null}
          onClick={() => void copyCommand()}
        />
        <ActionButton
          icon={isInDeck ? '✓' : '+'}
          label={
            isInDeck
              ? 'In Deck'
              : pendingAction === 'add'
                ? 'Adding…'
                : 'Add to Deck'
          }
          disabled={isInDeck || pendingAction !== null}
          onClick={() => void addToDeck()}
        />
      </div>

      <p
        className="min-h-4 pt-1.5 text-center text-[9px] text-slate-500"
        aria-live="polite"
      >
        {statusMessage}
      </p>
    </div>
  );
}

type ActionButtonProps = {
  icon: string;
  label: string;
  disabled?: boolean;
  onClick: () => void;
};

function ActionButton({
  icon,
  label,
  disabled = false,
  onClick,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      className="flex min-w-0 flex-col items-center gap-1 rounded-lg border border-white/7 px-1 py-1.5 text-center text-[9px] leading-3.5 text-slate-400 transition-colors hover:border-white/12 hover:bg-white/5 hover:text-slate-200 focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
