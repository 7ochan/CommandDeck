import type { IDisposable, IPty } from 'node-pty';

import type { PtyLaunch } from './pty-adapter.js';

export type TerminalExit = {
  exitCode: number;
  signal?: number;
};

type DataListener = (data: string) => void;
type ExitListener = (event: TerminalExit) => void;

export class TerminalSession {
  readonly id: string;
  readonly shell: string;
  readonly cwd: string;

  private readonly terminalProcess: IPty;
  private readonly dataListeners = new Set<DataListener>();
  private readonly exitListeners = new Set<ExitListener>();
  private readonly dataSubscription: IDisposable;
  private readonly exitSubscription: IDisposable;
  private pendingData = '';
  private exitEvent: TerminalExit | null = null;
  private closed = false;

  constructor(id: string, launch: PtyLaunch) {
    this.id = id;
    this.shell = launch.shell;
    this.cwd = launch.cwd;
    this.terminalProcess = launch.process;

    this.dataSubscription = this.terminalProcess.onData((data) => {
      if (this.dataListeners.size === 0) {
        this.pendingData += data;
        return;
      }

      for (const listener of this.dataListeners) {
        listener(data);
      }
    });

    this.exitSubscription = this.terminalProcess.onExit((event) => {
      this.closed = true;
      this.exitEvent = event;

      for (const listener of this.exitListeners) {
        listener(event);
      }

      this.disposeSubscriptions();
    });
  }

  get cols(): number {
    return this.terminalProcess.cols;
  }

  get rows(): number {
    return this.terminalProcess.rows;
  }

  onData(listener: DataListener): () => void {
    this.dataListeners.add(listener);

    if (this.pendingData.length > 0) {
      const data = this.pendingData;
      this.pendingData = '';
      queueMicrotask(() => {
        if (this.dataListeners.has(listener)) {
          listener(data);
        }
      });
    }

    return () => this.dataListeners.delete(listener);
  }

  onExit(listener: ExitListener): () => void {
    this.exitListeners.add(listener);

    if (this.exitEvent) {
      const event = this.exitEvent;
      queueMicrotask(() => {
        if (this.exitListeners.has(listener)) {
          listener(event);
        }
      });
    }

    return () => this.exitListeners.delete(listener);
  }

  write(data: string): void {
    if (!this.closed) {
      this.terminalProcess.write(data);
    }
  }

  resize(cols: number, rows: number): void {
    if (!this.closed && (cols !== this.cols || rows !== this.rows)) {
      this.terminalProcess.resize(cols, rows);
    }
  }

  close(): void {
    if (this.closed) {
      return;
    }

    this.closed = true;

    try {
      this.terminalProcess.kill();
    } catch {
      this.disposeSubscriptions();
    }
  }

  private disposeSubscriptions(): void {
    this.dataSubscription.dispose();
    this.exitSubscription.dispose();
    this.dataListeners.clear();
    this.exitListeners.clear();
  }
}
