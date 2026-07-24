'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { WorkspaceSummary } from '@/shared/types';

import {
  createWorkspace as createWorkspaceRequest,
  deleteWorkspace as deleteWorkspaceRequest,
  loadWorkspaces,
  renameWorkspace as renameWorkspaceRequest,
} from '../api';
import {
  loadActiveWorkspaceId,
  saveActiveWorkspaceId,
} from '../active-workspace-storage';

type WorkspacesState = {
  workspaces: WorkspaceSummary[];
  activeWorkspace: WorkspaceSummary | null;
  isLoading: boolean;
  loadError: string | null;
  selectWorkspace: (workspaceId: string) => void;
  createWorkspace: (name: string) => Promise<WorkspaceSummary>;
  renameWorkspace: (
    workspaceId: string,
    name: string,
  ) => Promise<WorkspaceSummary>;
  deleteWorkspace: (workspaceId: string) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
};

export function useWorkspaces(): WorkspacesState {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const activeWorkspaceIdRef = useRef(activeWorkspaceId);
  const workspacesRef = useRef(workspaces);
  const mutationRevisionRef = useRef(0);

  useEffect(() => {
    activeWorkspaceIdRef.current = activeWorkspaceId;
    workspacesRef.current = workspaces;
  }, [activeWorkspaceId, workspaces]);

  const applyWorkspaces = useCallback((loaded: WorkspaceSummary[]) => {
    const currentId = activeWorkspaceIdRef.current;
    const storedId = loadActiveWorkspaceId();
    const nextActiveId = loaded.some(
      ({ workspaceId }) => workspaceId === currentId,
    )
      ? currentId
      : loaded.some(({ workspaceId }) => workspaceId === storedId)
        ? storedId
        : loaded[0]?.workspaceId;

    setWorkspaces(loaded);
    setActiveWorkspaceId(nextActiveId ?? null);

    if (nextActiveId) {
      saveActiveWorkspaceId(nextActiveId);
    }
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    const revision = mutationRevisionRef.current;

    try {
      const loaded = await loadWorkspaces();

      if (revision === mutationRevisionRef.current) {
        applyWorkspaces(loaded);
        setLoadError(null);
      }
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Unable to refresh Workspaces.',
      );
    }
  }, [applyWorkspaces]);

  useEffect(() => {
    const controller = new AbortController();

    void loadWorkspaces(controller.signal)
      .then((loaded) => {
        applyWorkspaces(loaded);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Unable to load Workspaces.',
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [applyWorkspaces]);

  const selectWorkspace = useCallback((workspaceId: string) => {
    if (
      !workspacesRef.current.some(
        (workspace) => workspace.workspaceId === workspaceId,
      )
    ) {
      return;
    }

    activeWorkspaceIdRef.current = workspaceId;
    setActiveWorkspaceId(workspaceId);
    saveActiveWorkspaceId(workspaceId);
  }, []);

  const createWorkspace = useCallback(async (name: string) => {
    mutationRevisionRef.current += 1;
    const workspace = await createWorkspaceRequest(name);
    setWorkspaces((current) => {
      const next = [...current, workspace];
      workspacesRef.current = next;
      return next;
    });
    activeWorkspaceIdRef.current = workspace.workspaceId;
    setActiveWorkspaceId(workspace.workspaceId);
    saveActiveWorkspaceId(workspace.workspaceId);
    return workspace;
  }, []);

  const renameWorkspace = useCallback(
    async (workspaceId: string, name: string) => {
      mutationRevisionRef.current += 1;
      const workspace = await renameWorkspaceRequest(workspaceId, name);
      setWorkspaces((current) => {
        const next = current.map((candidate) =>
          candidate.workspaceId === workspaceId ? workspace : candidate,
        );
        workspacesRef.current = next;
        return next;
      });
      return workspace;
    },
    [],
  );

  const deleteWorkspace = useCallback(async (workspaceId: string) => {
    mutationRevisionRef.current += 1;
    await deleteWorkspaceRequest(workspaceId);
    const remaining = workspacesRef.current.filter(
      (workspace) => workspace.workspaceId !== workspaceId,
    );
    const nextActiveId =
      activeWorkspaceIdRef.current === workspaceId
        ? (remaining[0]?.workspaceId ?? null)
        : activeWorkspaceIdRef.current;

    setWorkspaces(remaining);
    workspacesRef.current = remaining;
    setActiveWorkspaceId(nextActiveId);
    activeWorkspaceIdRef.current = nextActiveId;

    if (nextActiveId) {
      saveActiveWorkspaceId(nextActiveId);
    }
  }, []);

  const activeWorkspace = useMemo(
    () =>
      workspaces.find(
        (workspace) => workspace.workspaceId === activeWorkspaceId,
      ) ?? null,
    [activeWorkspaceId, workspaces],
  );

  return {
    workspaces,
    activeWorkspace,
    isLoading,
    loadError,
    selectWorkspace,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    refreshWorkspaces,
  };
}
