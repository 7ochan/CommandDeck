'use client';

import type { IDisposable, Terminal as XtermTerminal } from '@xterm/xterm';
import type { ForwardedRef } from 'react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import { parseTerminalServerMessage } from '@/shared/contracts';
import type { CommandCompletedPayload } from '@/shared/types';

import {
  createTerminalWebSocket,
  executeTerminalCommand,
  sendTerminalInput,
  sendTerminalResize,
  selectTerminalWorkspace,
} from '../terminal-client';
import { TERMINAL_PRESENTATION_OPTIONS } from '../terminal-presentation';

type ConnectionStatus =
  'connecting' | 'connected' | 'disconnected' | 'error' | 'exited';

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  connecting: 'Connecting',
  connected: 'Connected',
  disconnected: 'Disconnected',
  error: 'Connection error',
  exited: 'Shell exited',
};

type TerminalProps = {
  workspaceId: string;
  workspaceName: string;
  onCommandCompleted?: (command: CommandCompletedPayload) => void;
};

export type TerminalHandle = {
  runCommand: (command: string) => boolean;
  selectWorkspace: (workspaceId: string) => Promise<boolean>;
};

export const Terminal = forwardRef<TerminalHandle, TerminalProps>(TerminalView);

function TerminalView(
  { workspaceId, workspaceName, onCommandCompleted }: TerminalProps,
  ref: ForwardedRef<TerminalHandle>,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCommandCompletedRef = useRef(onCommandCompleted);
  const socketRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const desiredWorkspaceIdRef = useRef(workspaceId);
  const assignedWorkspaceIdRef = useRef<string | null>(null);
  const pendingWorkspaceSelectionRef = useRef<{
    workspaceId: string;
    resolve: (selected: boolean) => void;
    timeoutId: number;
  } | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [shellName, setShellName] = useState('Local shell');
  const [assignedWorkspaceId, setAssignedWorkspaceId] = useState<string | null>(
    null,
  );

  const selectWorkspace = useCallback(
    (targetWorkspaceId: string): Promise<boolean> => {
      if (assignedWorkspaceIdRef.current === targetWorkspaceId) {
        return Promise.resolve(true);
      }

      const socket = socketRef.current;
      const sessionId = sessionIdRef.current;

      if (!socket || !sessionId || socket.readyState !== WebSocket.OPEN) {
        return Promise.resolve(false);
      }

      const pendingSelection = pendingWorkspaceSelectionRef.current;

      if (pendingSelection) {
        window.clearTimeout(pendingSelection.timeoutId);
        pendingSelection.resolve(false);
      }

      return new Promise<boolean>((resolve) => {
        const timeoutId = window.setTimeout(() => {
          if (
            pendingWorkspaceSelectionRef.current?.workspaceId ===
            targetWorkspaceId
          ) {
            pendingWorkspaceSelectionRef.current = null;
            resolve(false);
          }
        }, 3_000);
        pendingWorkspaceSelectionRef.current = {
          workspaceId: targetWorkspaceId,
          resolve,
          timeoutId,
        };
        selectTerminalWorkspace(socket, sessionId, targetWorkspaceId);
      });
    },
    [],
  );

  useImperativeHandle(ref, () => ({
    runCommand: (command: string) => {
      const socket = socketRef.current;
      const sessionId = sessionIdRef.current;

      if (
        !socket ||
        !sessionId ||
        socket.readyState !== WebSocket.OPEN ||
        pendingWorkspaceSelectionRef.current !== null ||
        assignedWorkspaceIdRef.current !== desiredWorkspaceIdRef.current
      ) {
        return false;
      }

      executeTerminalCommand(socket, sessionId, command);
      return true;
    },
    selectWorkspace,
  }));

  useEffect(() => {
    onCommandCompletedRef.current = onCommandCompleted;
  }, [onCommandCompleted]);

  useEffect(() => {
    desiredWorkspaceIdRef.current = workspaceId;
    void selectWorkspace(workspaceId);
  }, [selectWorkspace, workspaceId]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    let disposed = false;
    let sessionId: string | null = null;
    let socket: WebSocket | null = null;
    let terminal: XtermTerminal | null = null;
    let inputSubscription: IDisposable | null = null;
    let resizeSubscription: IDisposable | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeFrame: number | null = null;
    let shellExited = false;

    const initialize = async () => {
      const [{ FitAddon }, { Terminal: TerminalEmulator }] = await Promise.all([
        import('@xterm/addon-fit'),
        import('@xterm/xterm'),
      ]);

      if (disposed) {
        return;
      }

      const fitAddon = new FitAddon();
      terminal = new TerminalEmulator(TERMINAL_PRESENTATION_OPTIONS);
      terminal.loadAddon(fitAddon);
      terminal.open(container);

      const fit = () => {
        if (
          disposed ||
          container.clientWidth === 0 ||
          container.clientHeight === 0
        ) {
          return;
        }

        try {
          fitAddon.fit();
        } catch {
          // A later ResizeObserver notification will retry after layout settles.
        }
      };

      const scheduleFit = () => {
        if (resizeFrame !== null) {
          cancelAnimationFrame(resizeFrame);
        }

        resizeFrame = requestAnimationFrame(() => {
          resizeFrame = null;
          fit();
        });
      };

      inputSubscription = terminal.onData((data) => {
        if (
          socket &&
          sessionId &&
          pendingWorkspaceSelectionRef.current === null &&
          assignedWorkspaceIdRef.current === desiredWorkspaceIdRef.current
        ) {
          sendTerminalInput(socket, sessionId, data);
        }
      });

      resizeSubscription = terminal.onResize(({ cols, rows }) => {
        if (socket && sessionId) {
          sendTerminalResize(socket, sessionId, cols, rows);
        }
      });

      resizeObserver = new ResizeObserver(scheduleFit);
      resizeObserver.observe(container);
      scheduleFit();
      void document.fonts.ready.then(scheduleFit);

      socket = createTerminalWebSocket(desiredWorkspaceIdRef.current);
      socketRef.current = socket;
      socket.addEventListener('message', (event) => {
        if (typeof event.data !== 'string' || !terminal) {
          return;
        }

        const message = parseTerminalServerMessage(event.data);

        if (!message) {
          setStatus('error');
          return;
        }

        if (message.type === 'terminal.started') {
          if (sessionId && sessionId !== message.sessionId) {
            terminal.reset();
          }

          sessionId = message.sessionId;
          sessionIdRef.current = sessionId;
          assignedWorkspaceIdRef.current = message.payload.workspaceId;
          setAssignedWorkspaceId(message.payload.workspaceId);
          setShellName(
            message.payload.shell.split(/[\\/]/).pop() ?? 'Local shell',
          );
          setStatus('connected');
          fit();
          sendTerminalResize(
            socket as WebSocket,
            sessionId,
            terminal.cols,
            terminal.rows,
          );
          const pendingSelection = pendingWorkspaceSelectionRef.current;

          if (pendingSelection?.workspaceId === message.payload.workspaceId) {
            window.clearTimeout(pendingSelection.timeoutId);
            pendingWorkspaceSelectionRef.current = null;
            pendingSelection.resolve(true);
          } else {
            void selectWorkspace(desiredWorkspaceIdRef.current);
          }

          terminal.focus();
          return;
        }

        if (message.sessionId !== sessionId) {
          return;
        }

        if (message.type === 'terminal.output') {
          terminal.write(message.payload.data);
          return;
        }

        if (message.type === 'terminal.workspace.selected') {
          assignedWorkspaceIdRef.current = message.payload.workspaceId;
          setAssignedWorkspaceId(message.payload.workspaceId);
          const pendingSelection = pendingWorkspaceSelectionRef.current;

          if (pendingSelection?.workspaceId === message.payload.workspaceId) {
            window.clearTimeout(pendingSelection.timeoutId);
            pendingWorkspaceSelectionRef.current = null;
            pendingSelection.resolve(true);
          }
          return;
        }

        if (message.type === 'command.completed') {
          onCommandCompletedRef.current?.(message.payload);
          return;
        }

        if (message.type === 'terminal.exited') {
          shellExited = true;
          setStatus('exited');
          terminal.write(
            `\r\n\x1b[2m[Process exited with code ${message.payload.exitCode}]\x1b[0m\r\n`,
          );
          return;
        }

        if (message.type === 'terminal.error') {
          const pendingSelection = pendingWorkspaceSelectionRef.current;

          if (pendingSelection) {
            window.clearTimeout(pendingSelection.timeoutId);
            pendingWorkspaceSelectionRef.current = null;
            pendingSelection.resolve(false);
          }

          setStatus('error');
        }
      });

      socket.addEventListener('close', () => {
        if (!disposed && !shellExited) {
          setStatus('disconnected');
        }
      });

      socket.addEventListener('error', () => {
        if (!disposed) {
          setStatus('error');
        }
      });
    };

    void initialize().catch((error: unknown) => {
      console.error('Unable to initialize terminal:', error);

      if (!disposed) {
        setStatus('error');
      }
    });

    return () => {
      disposed = true;
      sessionIdRef.current = null;
      assignedWorkspaceIdRef.current = null;

      const pendingSelection = pendingWorkspaceSelectionRef.current;

      if (pendingSelection) {
        window.clearTimeout(pendingSelection.timeoutId);
        pendingSelection.resolve(false);
        pendingWorkspaceSelectionRef.current = null;
      }

      if (socketRef.current === socket) {
        socketRef.current = null;
      }

      inputSubscription?.dispose();
      resizeSubscription?.dispose();
      resizeObserver?.disconnect();

      if (resizeFrame !== null) {
        cancelAnimationFrame(resizeFrame);
      }

      socket?.close(1000, 'Terminal component unmounted');
      terminal?.dispose();
    };
  }, [selectWorkspace]);

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#080c12] shadow-2xl shadow-black/30">
      <div className="flex min-h-12 shrink-0 items-center justify-between gap-4 border-b border-white/8 bg-white/[0.025] px-4 py-2 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="size-1.5 shrink-0 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.45)]"
            aria-hidden="true"
          />
          <p
            className="min-w-0 truncate text-xs text-slate-300"
            aria-label={`Workspace: ${workspaceName}`}
            aria-live="polite"
          >
            <span className="text-slate-500">Workspace:</span>{' '}
            <span className="font-medium text-cyan-100/90">
              {workspaceName}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 font-mono text-[10px] tracking-wide text-slate-500 sm:text-[11px]">
          <span className="hidden text-slate-600 sm:inline">{shellName}</span>
          <span className="hidden text-slate-700 sm:inline" aria-hidden="true">
            ·
          </span>
          <span aria-live="polite">
            {assignedWorkspaceId !== workspaceId
              ? 'Switching workspace…'
              : STATUS_LABELS[status]}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 p-3 sm:p-4 lg:p-5">
        <div
          ref={containerRef}
          className="commanddeck-terminal h-full min-h-0 w-full min-w-0"
          aria-label="Interactive local terminal"
        />
      </div>
    </section>
  );
}
