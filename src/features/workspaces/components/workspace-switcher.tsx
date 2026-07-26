'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import { Icon } from '@/components/ui/icon';
import type { WorkspaceSummary } from '@/shared/types';
import { useSettings } from '@/features/settings/settings-provider';

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
  const { settings } = useSettings();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [isManaging, setIsManaging] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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

  const handleQuickCreate = async () => {
    const defaultName = `Session ${workspaces.length + 1}`;
    setBusyWorkspaceId('new');
    try {
      const created = await onCreate(defaultName);
      onSelect(created.workspaceId);
    } catch {
      setIsManaging(true);
    } finally {
      setBusyWorkspaceId(null);
    }
  };

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newName.trim();

    if (!name) {
      return;
    }

    setBusyWorkspaceId('new');
    setError(null);

    try {
      const created = await onCreate(name);
      setNewName('');
      onSelect(created.workspaceId);
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
      (settings.general.confirmBeforeDeletingWorkspace &&
        !window.confirm(
          `Delete “${workspace.name}” and all of its History and Deck items?`,
        ))
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

  const filteredWorkspaces = workspaces.filter((ws) =>
    ws.name.toLowerCase().includes(searchQuery.toLowerCase().trim()),
  );

  return (
    <>
      <aside
        className="cd-surface flex w-64 shrink-0 flex-col overflow-hidden rounded-[15px] lg:w-64"
        aria-label="Workspace tabs navigation"
      >
        {/* Sidebar Search + Filter Header */}
        <div className="flex h-11 shrink-0 items-center justify-between gap-1.5 border-b border-[var(--border-soft)] px-2.5">
          <div className="relative flex min-w-0 flex-1 items-center">
            <span className="pointer-events-none absolute left-2 text-[var(--text-subtle)]">
              <Icon name="search" size={13} />
            </span>
            <input
              type="text"
              value={searchQuery}
              placeholder="Search tabs…"
              aria-label="Search tabs"
              className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--canvas-raised)] py-1 pr-2 pl-7 text-[11px] text-[var(--text-primary)] placeholder-[var(--text-subtle)] transition-colors outline-none focus:border-[var(--accent-border)]"
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
            title="Filter / Manage Workspaces"
            aria-label="Filter / Manage Workspaces"
            onClick={() => setIsManaging(true)}
          >
            <Icon name="filter" size={14} />
          </button>
          <button
            type="button"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
            title="New Workspace tab"
            aria-label="New Workspace tab"
            onClick={() => void handleQuickCreate()}
          >
            <Icon name="plus" size={14} />
          </button>
        </div>

        {/* Workspace Tab Cards List */}
        <div className="cd-scrollbar flex min-h-0 flex-1 flex-col space-y-1 overflow-y-auto p-2">
          {filteredWorkspaces.map((workspace) => {
            const isActive =
              workspace.workspaceId === activeWorkspace.workspaceId;
            return (
              <button
                key={workspace.workspaceId}
                type="button"
                onClick={() => onSelect(workspace.workspaceId)}
                className={`group flex w-full items-center gap-2.5 rounded-[10px] border px-2.5 py-2 text-left transition-all ${
                  isActive
                    ? 'border-[var(--border-strong)] bg-[var(--surface-3)] text-[var(--text-primary)] shadow-sm'
                    : 'border-transparent text-[var(--text-secondary)] hover:border-[var(--border-soft)] hover:bg-[var(--surface-2)]'
                }`}
              >
                <div
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                    isActive
                      ? 'border-[var(--accent-border)] bg-[var(--surface-3)] text-[var(--accent-strong)]'
                      : 'border-[var(--border-soft)] bg-[var(--canvas-raised)] text-[var(--text-muted)]'
                  }`}
                >
                  <Icon name="terminal" size={12} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[12px] leading-4 font-semibold text-[var(--text-primary)]">
                    {workspace.name}
                  </span>
                  <span className="flex items-center gap-1 font-mono text-[10px] text-[var(--text-muted)]">
                    <Icon name="branch" size={10} /> main
                  </span>
                </div>
              </button>
            );
          })}

          {/* New Session Quick Item */}
          <button
            type="button"
            onClick={() => void handleQuickCreate()}
            className="group flex w-full items-center gap-2.5 rounded-[10px] border border-transparent px-2.5 py-2 text-left text-[var(--text-muted)] transition-all hover:border-[var(--border-soft)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--canvas-raised)] text-[var(--text-muted)]">
              <Icon name="terminal" size={12} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block truncate font-mono text-[12px] leading-4 font-medium text-[var(--text-muted)] group-hover:text-[var(--text-primary)]">
                New session
              </span>
              <span className="flex items-center gap-1 font-mono text-[10px] text-[var(--text-subtle)]">
                <Icon name="branch" size={10} /> main
              </span>
            </div>
          </button>
        </div>

        {/* Connection status indicator */}
        {connectionStatus && (
          <div className="flex shrink-0 items-center justify-between border-t border-[var(--border-soft)] px-3 py-2 text-[10px]">
            <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
              <span
                className={`size-1.5 rounded-full ${connectionStatusDotClass(connectionStatus.tone)}`}
              />
              {connectionStatus.label}
            </span>
            <button
              type="button"
              className="text-[var(--text-subtle)] hover:text-[var(--text-muted)]"
              onClick={() => setIsManaging(true)}
            >
              Manage
            </button>
          </div>
        )}
      </aside>

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
                  className="cd-history-row rounded-[11px] border border-[var(--border-soft)] bg-[var(--canvas-raised)] p-3"
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
