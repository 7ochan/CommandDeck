import type { CommandLifecycleEvent } from '../../shared/types/command.js';

type CommandEventListener = (event: CommandLifecycleEvent) => void;

export class CommandEventBus {
  private readonly listeners = new Set<CommandEventListener>();

  publish(event: CommandLifecycleEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  subscribe(listener: CommandEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  clear(): void {
    this.listeners.clear();
  }
}
