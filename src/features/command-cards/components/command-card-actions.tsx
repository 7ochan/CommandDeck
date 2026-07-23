'use client';

import { useState } from 'react';

import { copyCommandText } from '../clipboard';
import type { CommandCard } from '../types';
import { DeleteCommandCardDialog } from './delete-command-card-dialog';

type CommandCardActionsProps = {
  card: CommandCard;
  panelId: string;
  onRunAgain: (command: string) => boolean;
  onDelete: (commandId: string) => Promise<void>;
};

type ActionId = 'run' | 'copy' | 'delete';

export function CommandCardActions({
  card,
  panelId,
  onRunAgain,
  onDelete,
}: CommandCardActionsProps) {
  const [pendingAction, setPendingAction] = useState<ActionId | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const runAgain = () => {
    setStatusMessage(
      onRunAgain(card.command)
        ? 'Command sent to the active terminal.'
        : 'The active terminal is not connected.',
    );
  };

  const copyCommand = async () => {
    setPendingAction('copy');
    setStatusMessage(null);

    try {
      await copyCommandText(card.command);
      setStatusMessage('Command copied.');
    } catch {
      setStatusMessage('Unable to access the clipboard.');
    } finally {
      setPendingAction(null);
    }
  };

  const confirmDelete = async () => {
    setPendingAction('delete');
    setDeleteError(null);

    try {
      await onDelete(card.commandId);
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : 'Unable to delete this card.',
      );
      setPendingAction(null);
    }
  };

  return (
    <>
      <div
        id={panelId}
        className="border-t border-white/6 px-3 py-3"
        aria-label="Command card actions"
      >
        <div className="grid grid-cols-3 gap-1.5">
          <ActionButton icon="▶" label="Run Again" onClick={runAgain} />
          <ActionButton
            icon="📋"
            label={pendingAction === 'copy' ? 'Copying…' : 'Copy Command'}
            disabled={pendingAction !== null}
            onClick={() => void copyCommand()}
          />
          <ActionButton
            icon="🗑"
            label="Delete Card"
            tone="danger"
            disabled={pendingAction !== null}
            onClick={() => {
              setDeleteError(null);
              setDeleteDialogOpen(true);
            }}
          />
        </div>

        <p
          className="min-h-4 pt-2 text-center text-[10px] text-slate-500"
          aria-live="polite"
        >
          {statusMessage}
        </p>
      </div>

      <DeleteCommandCardDialog
        command={card.command}
        isOpen={deleteDialogOpen}
        isDeleting={pendingAction === 'delete'}
        error={deleteError}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}

type ActionButtonProps = {
  icon: string;
  label: string;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  onClick: () => void;
};

function ActionButton({
  icon,
  label,
  tone = 'default',
  disabled = false,
  onClick,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      className={`flex min-w-0 flex-col items-center gap-1 rounded-lg border px-1.5 py-2 text-center text-[10px] leading-4 transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === 'danger'
          ? 'border-rose-300/10 text-rose-300/75 hover:border-rose-300/20 hover:bg-rose-300/8 focus-visible:ring-rose-300/70'
          : 'border-white/7 text-slate-400 hover:border-white/12 hover:bg-white/5 hover:text-slate-200 focus-visible:ring-emerald-300/70'
      }`}
      disabled={disabled}
      onClick={onClick}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
