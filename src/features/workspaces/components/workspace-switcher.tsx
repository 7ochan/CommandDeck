'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

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
        className="flex h-11 shrink-0 items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-[#080d14] px-2.5 shadow-[0_10px_35px_rgba(0,0,0,0.12)]"
        aria-label="Active Workspace"
      >
        <label className="flex min-w-0 items-center gap-2">
          <span
            className="hidden size-7 shrink-0 items-center justify-center rounded-md bg-cyan-300/8 font-mono text-[10px] text-cyan-200/70 sm:flex"
            aria-hidden="true"
          >
            {'//'}
          </span>
          <span className="min-w-0">
            <span className="block font-mono text-[8px] tracking-[0.14em] text-slate-600 uppercase">
              Workspace
            </span>
            <select
              value={activeWorkspace.workspaceId}
              title={activeWorkspace.name}
              className="block h-5 max-w-[42vw] cursor-pointer truncate border-0 bg-transparent p-0 pr-5 text-[11px] font-medium text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 sm:max-w-72"
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
          {connectionStatus && (
            <span
              className="flex items-center gap-1.5 rounded-full bg-white/[0.025] px-2 py-1 font-mono text-[9px] text-slate-500"
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
            className="flex size-8 items-center justify-center rounded-md text-sm tracking-widest text-slate-500 hover:bg-white/5 hover:text-slate-200 focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:outline-none"
            aria-label="Manage Workspaces"
            title="Manage Workspaces"
            onClick={() => setIsManaging(true)}
          >
            <span aria-hidden="true">•••</span>
          </button>
        </div>
      </section>

      <dialog
        ref={dialogRef}
        className="m-auto w-[min(42rem,calc(100vw-2rem))] rounded-xl border border-white/12 bg-[#0b1018] p-0 text-slate-200 shadow-2xl shadow-black/60 backdrop:bg-black/70"
        aria-labelledby={titleId}
        onCancel={() => setIsManaging(false)}
        onClose={() => {
          if (isManaging) {
            setIsManaging(false);
          }
        }}
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id={titleId} className="text-sm font-semibold text-slate-100">
                Manage Workspaces
              </h2>
              <p className="mt-1.5 text-xs leading-5 text-slate-400">
                Each Workspace owns an isolated Command History and Deck.
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-400 hover:bg-white/5"
              onClick={() => setIsManaging(false)}
            >
              Close
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
              className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-slate-200 outline-none placeholder:text-slate-700 focus:border-emerald-300/40 focus:ring-2 focus:ring-emerald-300/10"
              onChange={(event) => setNewName(event.currentTarget.value)}
            />
            <button
              type="submit"
              disabled={!newName.trim() || busyWorkspaceId !== null}
              className="rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-3 text-xs text-emerald-200 hover:bg-emerald-300/15 disabled:opacity-40"
            >
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
                  className="rounded-lg border border-white/8 bg-black/15 p-3"
                >
                  <div className="flex items-center gap-2">
                    <input
                      maxLength={80}
                      value={
                        draftNames[workspace.workspaceId] ?? workspace.name
                      }
                      aria-label={`Rename ${workspace.name}`}
                      className="h-8 min-w-0 flex-1 rounded-md border border-white/8 bg-black/20 px-2.5 text-xs text-slate-200 outline-none focus:border-cyan-300/40"
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
                      className="rounded-md border border-white/10 px-2.5 py-1.5 text-[10px] text-slate-300 hover:bg-white/5 disabled:opacity-35"
                      onClick={() => void rename(workspace)}
                    >
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
                      className="rounded-md border border-rose-300/15 px-2.5 py-1.5 text-[10px] text-rose-300/75 hover:bg-rose-300/8 disabled:opacity-30"
                      onClick={() => void remove(workspace)}
                    >
                      Delete
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-3 font-mono text-[9px] text-slate-600">
                    {workspace.workspaceId === activeWorkspace.workspaceId && (
                      <span className="text-cyan-300/70">Active</span>
                    )}
                    <span>{workspace.historyCount} History</span>
                    <span>{workspace.deckCount} Deck</span>
                  </div>
                </div>
              );
            })}
          </div>

          {error && (
            <p className="mt-3 text-xs text-rose-300" role="alert">
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
    return 'bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.45)]';
  }

  if (tone === 'pending') {
    return 'animate-pulse bg-amber-300 motion-reduce:animate-none';
  }

  if (tone === 'error') {
    return 'bg-rose-300';
  }

  return 'bg-slate-500';
}
