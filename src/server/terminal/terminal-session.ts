import type { IDisposable, IPty } from 'node-pty';

import { CommandCapture } from '../commands/command-capture.js';
import { OscShellIntegrationParser } from '../shell-integration/parsers/osc-parser.js';
import type { CommandLifecycleEvent } from '../../shared/types/command.js';
import type { PtyLaunch } from './pty-adapter.js';

export type TerminalExit = {
  exitCode: number;
  signal?: number;
};

type DataListener = (data: string) => void;
type ExitListener = (event: TerminalExit) => void;
type CommandListener = (event: CommandLifecycleEvent) => void;
type CwdListener = (event: { cwd: string; workspaceId: string }) => void;

export class TerminalSession {
  readonly id: string;
  readonly shell: string;

  private readonly terminalProcess: IPty;
  private readonly dataListeners = new Set<DataListener>();
  private readonly exitListeners = new Set<ExitListener>();
  private readonly commandListeners = new Set<CommandListener>();
  private readonly cwdListeners = new Set<CwdListener>();
  private readonly dataSubscription: IDisposable;
  private readonly exitSubscription: IDisposable;
  private readonly commandCapture: CommandCapture;
  private readonly integrationParser: OscShellIntegrationParser | null;
  private readonly removeCaptureListener: () => void;
  private readonly disposeLaunch: () => void;
  private pendingData = '';
  private exitEvent: TerminalExit | null = null;
  private currentCwd: string;
  private currentWorkspaceId: string;
  private closed = false;

  constructor(id: string, launch: PtyLaunch, initialWorkspaceId: string) {
    this.id = id;
    this.shell = launch.shell;
    this.currentCwd = launch.cwd;
    this.currentWorkspaceId = initialWorkspaceId;
    this.terminalProcess = launch.process;
    this.disposeLaunch = launch.dispose;
    this.commandCapture = new CommandCapture(launch.cwd, initialWorkspaceId);
    this.integrationParser = launch.integration
      ? new OscShellIntegrationParser(launch.integration)
      : null;
    this.removeCaptureListener = this.commandCapture.onEvent((event) => {
      for (const listener of this.commandListeners) {
        listener(event);
      }
    });

    this.dataSubscription = this.terminalProcess.onData((data) => {
      if (!this.integrationParser) {
        this.emitData(data);
        return;
      }

      for (const token of this.integrationParser.push(data)) {
        if (token.type === 'output') {
          this.emitData(token.data);
        } else {
          this.commandCapture.accept(token.marker);

          if (token.marker.type === 'cwd') {
            this.currentCwd = token.marker.cwd;
            this.emitCwd(token.marker.cwd);
          }
        }
      }
    });

    this.exitSubscription = this.terminalProcess.onExit((event) => {
      const remainingOutput = this.integrationParser?.drain();

      if (remainingOutput) {
        this.emitData(remainingOutput);
      }

      this.commandCapture.handleSessionExit(event.exitCode);
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

  get workspaceId(): string {
    return this.currentWorkspaceId;
  }

  get cwd(): string {
    return this.currentCwd;
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

  onCommand(listener: CommandListener): () => void {
    this.commandListeners.add(listener);
    return () => this.commandListeners.delete(listener);
  }

  onCwd(listener: CwdListener): () => void {
    this.cwdListeners.add(listener);
    return () => this.cwdListeners.delete(listener);
  }

  setWorkspace(workspaceId: string): void {
    this.currentWorkspaceId = workspaceId;
    this.commandCapture.setWorkspace(workspaceId);
  }

  write(data: string): void {
    if (!this.closed) {
      this.terminalProcess.write(data);
    }
  }

  execute(command: string): void {
    if (!this.closed) {
      this.terminalProcess.write(`${command}\r`);
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
    this.removeCaptureListener();
    this.disposeLaunch();
    this.dataListeners.clear();
    this.exitListeners.clear();
    this.commandListeners.clear();
    this.cwdListeners.clear();
  }

  private emitData(data: string): void {
    if (this.dataListeners.size === 0) {
      this.pendingData += data;
      return;
    }

    for (const listener of this.dataListeners) {
      listener(data);
    }
  }

  private emitCwd(cwd: string): void {
    const event = { cwd, workspaceId: this.currentWorkspaceId };

    for (const listener of this.cwdListeners) {
      listener(event);
    }
  }
}
