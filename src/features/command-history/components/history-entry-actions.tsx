'use client';

import { useState } from 'react';

import { Icon, type IconName } from '@/components/ui/icon';
import { copyCommandText } from '../clipboard.ts';
import type { CommandHistoryEntry } from '../types.ts';

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
      className="border-t border-[var(--border-soft)] px-2.5 py-2.5"
      aria-label="Command History actions"
    >
      <div className="grid grid-cols-3 gap-1.5">
        <ActionButton icon="play" label="Run Again" onClick={runAgain} />
        <ActionButton
          icon="copy"
          label={pendingAction === 'copy' ? 'Copying…' : 'Copy'}
          disabled={pendingAction !== null}
          onClick={() => void copyCommand()}
        />
        <ActionButton
          icon={isInDeck ? 'check' : 'plus'}
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
        className="min-h-4 pt-1.5 text-center text-[10px] text-[var(--text-muted)]"
        aria-live="polite"
      >
        {statusMessage}
      </p>
    </div>
  );
}

type ActionButtonProps = {
  icon: IconName;
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
      className="flex min-w-0 items-center justify-center gap-1.5 rounded-md border border-[var(--border-soft)] bg-[var(--surface-2)] px-1 py-2 text-center text-[10px] leading-4 font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} size={13} />
      <span>{label}</span>
    </button>
  );
}
