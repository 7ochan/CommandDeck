'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import { Icon } from '@/components/ui/icon';
import type { WorkspaceSummary } from '@/shared/types';

type RenameWorkspaceDialogProps = {
  workspace: WorkspaceSummary | null;
  isOpen: boolean;
  onRename: (workspaceId: string, newName: string) => Promise<unknown>;
  onClose: () => void;
};

export function RenameWorkspaceDialog({
  workspace,
  isOpen,
  onRename,
  onClose,
}: RenameWorkspaceDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  const [prevWorkspaceId, setPrevWorkspaceId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (workspace && workspace.workspaceId !== prevWorkspaceId) {
    setPrevWorkspaceId(workspace.workspaceId);
    setName(workspace.name);
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      setError(null);
      setIsSaving(false);
      dialog.showModal();
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!workspace) return;

    const trimmed = name.trim();
    if (!trimmed || trimmed === workspace.name) {
      onClose();
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onRename(workspace.workspaceId, trimmed);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to rename Workspace.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!workspace) {
    return null;
  }

  return (
    <dialog
      ref={dialogRef}
      className="cd-dialog w-[min(32rem,calc(100vw-1.5rem))] p-0"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (isOpen) {
          onClose();
        }
      }}
    >
      <form className="p-5 sm:p-6" onSubmit={handleSubmit}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="cd-empty-mark size-9 shrink-0 text-[var(--accent)]">
              <Icon name="workspace" size={17} />
            </span>
            <div>
              <h2
                id={titleId}
                className="text-[15px] font-semibold text-[var(--text-primary)]"
              >
                Rename Workspace
              </h2>
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                Enter a new display name for this workspace tab.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="cd-icon-button"
            aria-label="Close"
            onClick={onClose}
          >
            <Icon name="x" size={15} />
          </button>
        </div>

        <div className="mt-5">
          <label className="mb-1.5 block font-mono text-[11px] font-medium text-[var(--text-secondary)]">
            Workspace Name
          </label>
          <input
            ref={inputRef}
            type="text"
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="cd-input h-10 w-full px-3 text-[13px]"
            placeholder="Workspace name"
          />
        </div>

        {error && (
          <p className="mt-3 text-[12px] text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="cd-button cd-button--quiet h-9 px-4 text-[12px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || isSaving}
            className="cd-button cd-button--primary h-9 px-4 text-[12px]"
          >
            {isSaving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
