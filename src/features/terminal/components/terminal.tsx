'use client';

import type { IDisposable, Terminal as XtermTerminal } from '@xterm/xterm';
import { useEffect, useRef, useState } from 'react';

import { parseTerminalServerMessage } from '@/shared/contracts';
import type { CommandCompletedPayload } from '@/shared/types';

import {
  createTerminalWebSocket,
  sendTerminalInput,
  sendTerminalResize,
} from '../terminal-client';

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
  onCommandCompleted?: (command: CommandCompletedPayload) => void;
};

export function Terminal({ onCommandCompleted }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCommandCompletedRef = useRef(onCommandCompleted);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [shellName, setShellName] = useState('Local shell');

  useEffect(() => {
    onCommandCompletedRef.current = onCommandCompleted;
  }, [onCommandCompleted]);

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
      terminal = new TerminalEmulator({
        allowProposedApi: false,
        cursorBlink: true,
        cursorStyle: 'bar',
        fontFamily:
          "'SFMono-Regular', 'Cascadia Code', 'Liberation Mono', Menlo, monospace",
        fontSize: 14,
        lineHeight: 1.2,
        scrollback: 5_000,
        theme: {
          background: '#070b11',
          foreground: '#d8e2ef',
          cursor: '#6ee7b7',
          cursorAccent: '#070b11',
          selectionBackground: '#334155aa',
          black: '#0f172a',
          red: '#fb7185',
          green: '#6ee7b7',
          yellow: '#fbbf24',
          blue: '#60a5fa',
          magenta: '#c084fc',
          cyan: '#22d3ee',
          white: '#e2e8f0',
          brightBlack: '#64748b',
          brightRed: '#fda4af',
          brightGreen: '#a7f3d0',
          brightYellow: '#fde68a',
          brightBlue: '#93c5fd',
          brightMagenta: '#d8b4fe',
          brightCyan: '#67e8f9',
          brightWhite: '#f8fafc',
        },
      });
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
        if (socket && sessionId) {
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

      socket = createTerminalWebSocket();
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
          sessionId = message.sessionId;
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
      inputSubscription?.dispose();
      resizeSubscription?.dispose();
      resizeObserver?.disconnect();

      if (resizeFrame !== null) {
        cancelAnimationFrame(resizeFrame);
      }

      socket?.close(1000, 'Terminal component unmounted');
      terminal?.dispose();
    };
  }, []);

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#070b11] shadow-2xl shadow-black/30">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/8 bg-white/3 px-4">
        <div className="flex min-w-0 items-center gap-2 font-mono text-xs text-slate-400">
          <span className="size-2 rounded-full bg-emerald-300" />
          <span className="truncate">{shellName}</span>
        </div>
        <span
          className="font-mono text-[11px] text-slate-500"
          aria-live="polite"
        >
          {STATUS_LABELS[status]}
        </span>
      </div>

      <div className="min-h-0 flex-1 p-3">
        <div
          ref={containerRef}
          className="commanddeck-terminal h-full w-full"
          aria-label="Interactive local terminal"
        />
      </div>
    </section>
  );
}
