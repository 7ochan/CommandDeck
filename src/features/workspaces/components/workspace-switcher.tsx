'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import { Icon } from '@/components/ui/icon';
import type { WorkspaceSummary } from '@/shared/types';

type WorkspaceSwitcherProps = {
  workspaces: WorkspaceSummary[];
  activeWorkspace: WorkspaceSummary;
  connectionStatus?: {
    label: string;
    tone: 'connected' | 'pending' | 'offline' | 'error';
  };
  onSelect: (workspaceId: string) => void;
  onCreate: (name: string) => Promise<WorkspaceSummary>;
  onRename: (workspaceId: string, name: string) => Promise<WorkspaceSummary>;
  onDelete: (workspaceId: string) => Promise<void>;
};

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspace,
  connectionStatus,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: WorkspaceSwitcherProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [isManaging, setIsManaging] = useState(false);
  const [newName, setNewName] = useState('');
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [busyWorkspaceId, setBusyWorkspaceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (isManaging && !dialog.open) {
      setError(null);
      dialog.showModal();
    } else if (!isManaging && dialog.open) {
      dialog.close();
    }
  }, [isManaging]);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newName.trim();

    if (!name) {
      return;
    }

    setBusyWorkspaceId('new');
    setError(null);

    try {
      await onCreate(name);
      setNewName('');
    } catch (createError) {
      setError(errorMessage(createError, 'Unable to create Workspace.'));
    } finally {
      setBusyWorkspaceId(null);
    }
  };

  const rename = async (workspace: WorkspaceSummary) => {
    const name = draftNames[workspace.workspaceId]?.trim();

    if (!name || name === workspace.name) {
      return;
    }

    setBusyWorkspaceId(workspace.workspaceId);
    setError(null);

    try {
      await onRename(workspace.workspaceId, name);
    } catch (renameError) {
      setError(errorMessage(renameError, 'Unable to rename Workspace.'));
    } finally {
      setBusyWorkspaceId(null);
    }
  };

  const remove = async (workspace: WorkspaceSummary) => {
    if (
      workspaces.length === 1 ||
      !window.confirm(
        `Delete “${workspace.name}” and all of its History and Deck items?`,
      )
    ) {
      return;
    }

    setBusyWorkspaceId(workspace.workspaceId);
    setError(null);

    try {
      await onDelete(workspace.workspaceId);
    } catch (deleteError) {
      setError(errorMessage(deleteError, 'Unable to delete Workspace.'));
    } finally {
      setBusyWorkspaceId(null);
    }
  };

  return (
    <>
      <section
        className="cd-surface flex h-12 shrink-0 items-center justify-between gap-3 rounded-[10px] px-2.5 shadow-none sm:px-3"
        aria-label="Active Workspace"
      >
        <label className="flex min-w-0 items-center gap-2">
          <span
            className="hidden size-7 shrink-0 items-center justify-center rounded-md bg-[var(--surface-3)] text-[var(--text-muted)] sm:flex"
            aria-hidden="true"
          >
            <Icon name="workspace" size={14} />
          </span>
          <span className="min-w-0">
            <span className="block font-mono text-[9px] leading-3 tracking-[0.1em] text-[var(--text-muted)] uppercase">
              Workspace
            </span>
            <select
              value={activeWorkspace.workspaceId}
              title={activeWorkspace.name}
              className="block h-5 max-w-[40vw] cursor-pointer truncate border-0 bg-transparent p-0 pr-5 text-[12px] font-semibold text-[var(--text-primary)] outline-none sm:max-w-72"
              onChange={(event) => onSelect(event.currentTarget.value)}
            >
              {workspaces.map((workspace) => (
                <option
                  key={workspace.workspaceId}
                  value={workspace.workspaceId}
                >
                  {workspace.name}
                </option>
              ))}
            </select>
          </span>
        </label>

        <div className="flex shrink-0 items-center gap-1.5">
          <span className="hidden font-mono text-[10px] text-[var(--text-muted)] md:inline">
            {activeWorkspace.historyCount} history
            <span className="mx-1.5 text-[var(--text-subtle)]">·</span>
            {activeWorkspace.deckCount} deck
          </span>
          {connectionStatus && (
            <span
              className="ml-1 flex items-center gap-1.5 rounded-md border border-[var(--border-soft)] bg-[var(--canvas-raised)] px-2 py-1 font-mono text-[10px] text-[var(--text-muted)]"
              role="status"
              aria-label={`Terminal ${connectionStatus.label}`}
              aria-live="polite"
            >
              <span
                className={`size-1.5 rounded-full ${connectionStatusDotClass(connectionStatus.tone)}`}
                aria-hidden="true"
              />
              <span className="max-w-24 truncate" aria-hidden="true">
                {connectionStatus.label}
              </span>
            </span>
          )}
          <button
            type="button"
            className="cd-icon-button border-transparent text-[var(--text-muted)]"
            aria-label="Manage Workspaces"
            title="Manage Workspaces"
            onClick={() => setIsManaging(true)}
          >
            <Icon name="more" size={17} />
          </button>
        </div>
      </section>

      <dialog
        ref={dialogRef}
        className="cd-dialog w-[min(42rem,calc(100vw-1.5rem))] p-0"
        aria-labelledby={titleId}
        onCancel={() => setIsManaging(false)}
        onClose={() => {
          if (isManaging) {
            setIsManaging(false);
          }
        }}
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="cd-empty-mark mb-3 size-9">
                <Icon name="workspace" size={17} />
              </span>
              <h2
                id={titleId}
                className="text-[15px] font-semibold text-[var(--text-primary)]"
              >
                Manage Workspaces
              </h2>
              <p className="mt-1.5 text-[12px] leading-5 text-[var(--text-muted)]">
                Each Workspace owns an isolated Command History and Deck.
              </p>
            </div>
            <button
              type="button"
              className="cd-icon-button"
              aria-label="Close Workspace manager"
              onClick={() => setIsManaging(false)}
            >
              <Icon name="x" size={15} />
            </button>
          </div>

          <form
            className="mt-5 flex gap-2"
            onSubmit={(event) => void create(event)}
          >
            <input
              required
              maxLength={80}
              value={newName}
              placeholder="New Workspace name"
              aria-label="New Workspace name"
              className="cd-input h-10 min-w-0 flex-1 px-3 text-[12px]"
              onChange={(event) => setNewName(event.currentTarget.value)}
            />
            <button
              type="submit"
              disabled={!newName.trim() || busyWorkspaceId !== null}
              className="cd-button cd-button--primary h-10"
            >
              <Icon name="plus" size={14} />
              {busyWorkspaceId === 'new' ? 'Creating…' : 'Create'}
            </button>
          </form>

          <div className="mt-4 max-h-[22rem] space-y-2 overflow-auto pr-1">
            {workspaces.map((workspace) => {
              const isBusy = busyWorkspaceId === workspace.workspaceId;
              const canRename =
                Boolean(draftNames[workspace.workspaceId]?.trim()) &&
                draftNames[workspace.workspaceId]?.trim() !== workspace.name;

              return (
                <div
                  key={workspace.workspaceId}
                  className="rounded-[10px] border border-[var(--border-soft)] bg-[var(--canvas-raised)] p-3"
                >
                  <div className="flex items-center gap-2">
                    <input
                      maxLength={80}
                      value={
                        draftNames[workspace.workspaceId] ?? workspace.name
                      }
                      aria-label={`Rename ${workspace.name}`}
                      className="cd-input h-9 min-w-0 flex-1 px-2.5 text-[12px]"
                      onChange={(event) =>
                        setDraftNames((current) => ({
                          ...current,
                          [workspace.workspaceId]: event.currentTarget.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      disabled={!canRename || busyWorkspaceId !== null}
                      className="cd-button h-9 min-h-0 px-2.5 text-[11px]"
                      onClick={() => void rename(workspace)}
                    >
                      <Icon name="edit" size={13} />
                      {isBusy ? 'Saving…' : 'Rename'}
                    </button>
                    <button
                      type="button"
                      disabled={
                        workspaces.length === 1 || busyWorkspaceId !== null
                      }
                      title={
                        workspaces.length === 1
                          ? 'The final Workspace cannot be deleted'
                          : `Delete ${workspace.name}`
                      }
                      className="cd-button cd-button--danger h-9 min-h-0 px-2.5 text-[11px]"
                      onClick={() => void remove(workspace)}
                    >
                      <Icon name="trash" size={13} />
                      <span className="hidden sm:inline">Delete</span>
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-3 font-mono text-[10px] text-[var(--text-muted)]">
                    {workspace.workspaceId === activeWorkspace.workspaceId && (
                      <span className="text-[var(--accent)]">Active</span>
                    )}
                    <span>{workspace.historyCount} History</span>
                    <span>{workspace.deckCount} Deck</span>
                  </div>
                </div>
              );
            })}
          </div>

          {error && (
            <p className="mt-3 text-[12px] text-[var(--danger)]" role="alert">
              {error}
            </p>
          )}
        </div>
      </dialog>
    </>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function connectionStatusDotClass(
  tone: NonNullable<WorkspaceSwitcherProps['connectionStatus']>['tone'],
): string {
  if (tone === 'connected') {
    return 'bg-[var(--accent)] shadow-[0_0_7px_rgba(115,217,173,0.35)]';
  }

  if (tone === 'pending') {
    return 'animate-pulse bg-[var(--warning)] motion-reduce:animate-none';
  }

  if (tone === 'error') {
    return 'bg-[var(--danger)]';
  }

  return 'bg-[var(--text-subtle)]';
}
