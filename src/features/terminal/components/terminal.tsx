'use client';

import type { IDisposable, Terminal as XtermTerminal } from '@xterm/xterm';
import type { ForwardedRef } from 'react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';

import { parseTerminalServerMessage } from '@/shared/contracts';
import type { CommandCompletedPayload } from '@/shared/types';
import { useSettings } from '@/features/settings/settings-provider';

import {
  createTerminalWebSocket,
  closeTerminalWorkspace,
  executeTerminalCommand,
  sendTerminalInput,
  sendTerminalResize,
  selectTerminalWorkspace,
} from '../terminal-client';
import { TerminalCommandSections } from '../terminal-command-sections';
import { getTerminalPresentationOptions } from '../terminal-presentation';

export type TerminalConnectionStatus =
  | 'connecting'
  | 'switching'
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'exited';

type TerminalProps = {
  workspaceId: string;
  active?: boolean;
  onCommandCompleted?: (command: CommandCompletedPayload) => void;
  onConnectionStatusChange?: (status: TerminalConnectionStatus) => void;
};

export type TerminalHandle = {
  runCommand: (command: string) => boolean;
  selectWorkspace: (workspaceId: string) => Promise<boolean>;
  closeWorkspaceSession: (workspaceId: string) => void;
};

export const Terminal = forwardRef<TerminalHandle, TerminalProps>(TerminalView);

function TerminalView(
  {
    workspaceId,
    active = true,
    onCommandCompleted,
    onConnectionStatusChange,
  }: TerminalProps,
  ref: ForwardedRef<TerminalHandle>,
) {
  const { settings, resolvedTheme } = useSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XtermTerminal | null>(null);
  const terminalSettingsRef = useRef(settings.terminal);
  const resolvedThemeRef = useRef(resolvedTheme);
  const autoFocusRef = useRef(settings.general.autoFocusTerminalAfterSwitching);
  const onCommandCompletedRef = useRef(onCommandCompleted);
  const onConnectionStatusChangeRef = useRef(onConnectionStatusChange);
  const socketRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const desiredWorkspaceIdRef = useRef(workspaceId);
  const assignedWorkspaceIdRef = useRef<string | null>(null);
  const pendingWorkspaceSelectionRef = useRef<{
    workspaceId: string;
    resolve: (selected: boolean) => void;
    timeoutId: number;
  } | null>(null);
  // Populated by the initialize effect so that the `active` effect can trigger
  // a fit + focus without being inside the same closure.
  const triggerFitAndFocusRef = useRef<
    ((shouldFocus?: boolean) => void) | null
  >(null);
  const reportConnectionStatus = useCallback(
    (status: TerminalConnectionStatus) =>
      onConnectionStatusChangeRef.current?.(status),
    [],
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

      reportConnectionStatus('switching');

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
            reportConnectionStatus('error');
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
    [reportConnectionStatus],
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
    closeWorkspaceSession: (workspaceId: string) => {
      const socket = socketRef.current;
      const sessionId = sessionIdRef.current;

      if (socket && sessionId && socket.readyState === WebSocket.OPEN) {
        closeTerminalWorkspace(socket, sessionId, workspaceId);
      }
    },
  }));

  useEffect(() => {
    onCommandCompletedRef.current = onCommandCompleted;
  }, [onCommandCompleted]);

  useEffect(() => {
    onConnectionStatusChangeRef.current = onConnectionStatusChange;
  }, [onConnectionStatusChange]);

  useEffect(() => {
    desiredWorkspaceIdRef.current = workspaceId;
    void selectWorkspace(workspaceId);
  }, [selectWorkspace, workspaceId]);

  useEffect(() => {
    terminalSettingsRef.current = settings.terminal;
    resolvedThemeRef.current = resolvedTheme;
    autoFocusRef.current = settings.general.autoFocusTerminalAfterSwitching;

    const terminal = terminalRef.current;

    if (terminal) {
      const options = getTerminalPresentationOptions(
        settings.terminal,
        resolvedTheme,
      );
      terminal.options.fontSize = options.fontSize;
      terminal.options.cursorStyle = options.cursorStyle;
      terminal.options.cursorBlink = options.cursorBlink;
      terminal.options.scrollback = options.scrollback;
      terminal.options.theme = options.theme;
      triggerFitAndFocusRef.current?.(false);
    }
  }, [
    resolvedTheme,
    settings.general.autoFocusTerminalAfterSwitching,
    settings.terminal,
  ]);

  // When this workspace's terminal becomes the visible one, snap to the
  // correct dimensions and focus xterm. This handles the case where the
  // window was resized while the terminal was CSS-hidden.
  useEffect(() => {
    if (active) {
      triggerFitAndFocusRef.current?.(autoFocusRef.current);
    }
  }, [active]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    let disposed = false;
    let sessionId: string | null = null;
    let socket: WebSocket | null = null;
    let terminal: XtermTerminal | null = null;
    let commandSections: TerminalCommandSections | null = null;
    let inputSubscription: IDisposable | null = null;
    let resizeSubscription: IDisposable | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeFrame: number | null = null;
    let shellExited = false;

    reportConnectionStatus('connecting');

    const initialize = async () => {
      const [{ FitAddon }, { Terminal: TerminalEmulator }] = await Promise.all([
        import('@xterm/addon-fit'),
        import('@xterm/xterm'),
      ]);

      if (disposed) {
        return;
      }

      const fitAddon = new FitAddon();
      terminal = new TerminalEmulator(
        getTerminalPresentationOptions(
          terminalSettingsRef.current,
          resolvedThemeRef.current,
        ),
      );
      terminalRef.current = terminal;
      terminal.loadAddon(fitAddon);
      terminal.open(container);
      const sectionPresentation = new TerminalCommandSections(terminal);
      commandSections = sectionPresentation;

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

      // Allow the `active`-prop effect to trigger a fit+focus from outside
      // this closure without adding initialize as an effect dependency.
      triggerFitAndFocusRef.current = (shouldFocus = true) => {
        fit();
        if (shouldFocus) terminal?.focus();
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
          reportConnectionStatus('error');
          return;
        }

        if (message.type === 'terminal.started') {
          if (sessionId && sessionId !== message.sessionId) {
            sectionPresentation.reset();
            terminal.reset();
          }

          sessionId = message.sessionId;
          sessionIdRef.current = sessionId;
          assignedWorkspaceIdRef.current = message.payload.workspaceId;
          reportConnectionStatus('connected');

          if (
            message.payload.bufferedOutput &&
            message.payload.bufferedOutput.length > 0
          ) {
            terminal.write(message.payload.bufferedOutput);
          }

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

          if (autoFocusRef.current) terminal.focus();
          return;
        }

        // Both terminal.started and terminal.workspace.selected are session-
        // establishment messages. They must be processed before the sessionId
        // guard because the client sessionId is null until one of them arrives.
        if (message.type === 'terminal.workspace.selected') {
          // Existing PTY reattached: reset xterm buffer cleanly and write full
          // output history (scrollback + active prompt).
          sectionPresentation.reset();
          terminal.reset();

          sessionId = message.payload.sessionId;
          sessionIdRef.current = sessionId;
          assignedWorkspaceIdRef.current = message.payload.workspaceId;
          reportConnectionStatus('connected');

          if (message.payload.bufferedOutput.length > 0) {
            terminal.write(message.payload.bufferedOutput);
          }

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
          }

          if (autoFocusRef.current) terminal.focus();
          return;
        }

        if (message.sessionId !== sessionId) {
          return;
        }

        if (message.type === 'terminal.output') {
          terminal.write(message.payload.data);
          return;
        }

        if (message.type === 'command.started') {
          sectionPresentation.commandStarted(message.payload.commandId);
          return;
        }

        if (message.type === 'command.completed') {
          sectionPresentation.commandCompleted(message.payload.commandId);
          onCommandCompletedRef.current?.(message.payload);
          return;
        }

        if (message.type === 'terminal.exited') {
          shellExited = true;
          reportConnectionStatus('exited');
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

          reportConnectionStatus('error');
        }
      });

      socket.addEventListener('close', () => {
        if (!disposed && !shellExited) {
          reportConnectionStatus('disconnected');
        }
      });

      socket.addEventListener('error', () => {
        if (!disposed) {
          reportConnectionStatus('error');
        }
      });
    };

    void initialize().catch((error: unknown) => {
      console.error('Unable to initialize terminal:', error);

      if (!disposed) {
        reportConnectionStatus('error');
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
      commandSections?.dispose();
      terminal?.dispose();
      terminalRef.current = null;
      triggerFitAndFocusRef.current = null;
    };
  }, [reportConnectionStatus, selectWorkspace]);

  return (
    <section
      className="cd-terminal-shell relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[15px] border border-[var(--border-soft)] bg-[var(--terminal)] p-2.5 sm:p-3.5"
      aria-label="Terminal"
    >
      <div
        ref={containerRef}
        className="commanddeck-terminal h-full min-h-0 w-full min-w-0 flex-1"
        aria-label="Interactive local terminal"
      />
    </section>
  );
}
