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

import { Icon } from '@/components/ui/icon';
import { parseTerminalServerMessage } from '@/shared/contracts';
import type { CommandCompletedPayload } from '@/shared/types';
import { useSettings } from '@/features/settings/settings-provider';

import {
  createTerminalWebSocket,
  closeTerminalWorkspace,
  executeTerminalCommand,
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
  focus: () => void;
  clear: () => void;
};

export type CommandBlockData = {
  id: string;
  command: string;
  output: string;
  status: 'running' | 'completed' | 'failed';
  exitCode?: number | null;
  startedAt: number;
};

function stripAnsi(str: string): string {
  return str.replace(
    /[\u001b\u009b][\[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=>]/g,
    '',
  );
}

function CommandBlockCard({ block }: { block: CommandBlockData }) {
  const cleanOutput = stripAnsi(block.output).trimEnd();

  return (
    <div className="cd-command-block flex flex-col overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--surface-1)] shadow-sm transition-all">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-soft)] bg-[var(--canvas-raised)] px-3.5 py-2.5 font-mono text-[12px]">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-bold text-[var(--accent)] select-none">❯</span>
          <span className="truncate font-semibold text-[var(--text-primary)]">
            {block.command}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2 font-mono text-[10px]">
          {block.status === 'running' && (
            <span className="flex animate-pulse items-center gap-1.5 font-medium text-[var(--accent)]">
              <span className="size-1.5 rounded-full bg-[var(--accent)]" />
              Running…
            </span>
          )}
          {block.status === 'completed' && (
            <span className="flex items-center gap-1.5 font-medium text-[#3fb950]">
              <span className="size-1.5 rounded-full bg-[#3fb950]" />
              {block.exitCode === 0 || block.exitCode == null
                ? 'Success'
                : `Exit ${block.exitCode}`}
            </span>
          )}
          {block.status === 'failed' && (
            <span className="flex items-center gap-1.5 font-medium text-[#f85149]">
              <span className="size-1.5 rounded-full bg-[#f85149]" />
              Failed {block.exitCode != null ? `(${block.exitCode})` : ''}
            </span>
          )}
        </div>
      </div>

      {cleanOutput ? (
        <pre className="cd-scrollbar max-h-[32rem] overflow-x-auto bg-[var(--terminal)] p-3.5 font-mono text-[12px] leading-relaxed break-words whitespace-pre-wrap text-[var(--text-secondary)]">
          {cleanOutput}
        </pre>
      ) : block.status === 'running' ? (
        <div className="px-3.5 py-3 font-mono text-[11px] text-[var(--text-subtle)] italic">
          Running process…
        </div>
      ) : null}
    </div>
  );
}

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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
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

  const [commandBlocks, setCommandBlocks] = useState<CommandBlockData[]>([]);
  const activeCommandIdRef = useRef<string | null>(null);
  const isUserScrolledUpRef = useRef<boolean>(false);

  const pendingWorkspaceSelectionRef = useRef<{
    workspaceId: string;
    resolve: (selected: boolean) => void;
    timeoutId: number;
  } | null>(null);

  const triggerFitAndFocusRef = useRef<
    ((shouldFocus?: boolean) => void) | null
  >(null);

  const reportConnectionStatus = useCallback(
    (status: TerminalConnectionStatus) =>
      onConnectionStatusChangeRef.current?.(status),
    [],
  );

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    isUserScrolledUpRef.current = distanceFromBottom > 35;
  }, []);

  useEffect(() => {
    if (!isUserScrolledUpRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, [commandBlocks]);

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
    focus: () => {
      triggerFitAndFocusRef.current?.(true);
    },
    clear: () => {
      setCommandBlocks([]);
      terminalRef.current?.clear();
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
        } catch {}
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

      triggerFitAndFocusRef.current = () => {
        fit();
      };

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
            setCommandBlocks([]);
          }

          sessionId = message.sessionId;
          sessionIdRef.current = sessionId;
          assignedWorkspaceIdRef.current = message.payload.workspaceId;
          reportConnectionStatus('connected');

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

          return;
        }

        if (message.type === 'terminal.workspace.selected') {
          sectionPresentation.reset();
          terminal.reset();

          sessionId = message.payload.sessionId;
          sessionIdRef.current = sessionId;
          assignedWorkspaceIdRef.current = message.payload.workspaceId;
          reportConnectionStatus('connected');

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

          return;
        }

        if (message.sessionId !== sessionId) {
          return;
        }

        if (message.type === 'command.started') {
          sectionPresentation.commandStarted(message.payload.commandId);
          const commandText = message.payload.command || 'Command';
          activeCommandIdRef.current = message.payload.commandId;

          setCommandBlocks((prev) => [
            ...prev,
            {
              id: message.payload.commandId,
              command: commandText,
              output: '',
              status: 'running',
              startedAt: Date.now(),
            },
          ]);
          return;
        }

        if (message.type === 'terminal.output') {
          terminal.write(message.payload.data);
          const outputData = message.payload.data;
          const activeId = activeCommandIdRef.current;

          setCommandBlocks((prev) => {
            if (prev.length === 0) {
              return [
                {
                  id: 'init-' + Date.now(),
                  command: 'Output',
                  output: outputData,
                  status: 'completed',
                  startedAt: Date.now(),
                },
              ];
            }

            return prev.map((block) => {
              if (
                block.id === activeId ||
                (!activeId && block === prev[prev.length - 1])
              ) {
                return { ...block, output: block.output + outputData };
              }
              return block;
            });
          });
          return;
        }

        if (message.type === 'command.completed') {
          sectionPresentation.commandCompleted(message.payload.commandId);
          onCommandCompletedRef.current?.(message.payload);

          const { commandId, exitCode } = message.payload;
          activeCommandIdRef.current = null;

          setCommandBlocks((prev) =>
            prev.map((block) => {
              if (block.id === commandId) {
                return {
                  ...block,
                  status:
                    exitCode != null && exitCode !== 0 ? 'failed' : 'completed',
                  exitCode,
                };
              }
              return block;
            }),
          );
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
    <div
      className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--terminal)]"
      aria-label="Terminal"
    >
      <div
        ref={containerRef}
        className="commanddeck-terminal hidden h-0 w-0 overflow-hidden"
        aria-hidden="true"
      />

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="cd-scrollbar flex min-h-0 flex-1 flex-col justify-end overflow-y-auto p-4 sm:p-5"
      >
        <div className="mt-auto flex flex-col gap-3.5">
          {commandBlocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center font-mono text-[12px] text-[var(--text-subtle)]">
              <Icon name="terminal" size={24} className="mb-2.5 opacity-40" />
              <p>Terminal session active. Enter a command below.</p>
            </div>
          ) : (
            commandBlocks.map((block) => (
              <CommandBlockCard key={block.id} block={block} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
