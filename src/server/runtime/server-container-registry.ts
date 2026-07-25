import type { CommandDeckService } from '../commands/deck-service';
import type { CommandHistoryService } from '../commands/history-service';
import type { TerminalGateway } from '../websocket/terminal-gateway';
import type { WorkspaceService } from '../workspaces/workspace-service';
import type { SettingsService } from '../settings/settings-service';

const CONTAINER_KEY = '__commandDeckServerContainer__';

export type ServerContainer = {
  commandHistoryService: CommandHistoryService;
  commandDeckService: CommandDeckService;
  workspaceService: WorkspaceService;
  settingsService: SettingsService;
  terminalGateway: TerminalGateway;
  databasePath: string;
  close: () => void;
};

type RuntimeGlobal = typeof globalThis & {
  [CONTAINER_KEY]?: ServerContainer;
};

const runtimeGlobal = globalThis as RuntimeGlobal;

export function registerServerContainer(container: ServerContainer): void {
  runtimeGlobal[CONTAINER_KEY] = container;
}

export function getServerContainer(): ServerContainer {
  const container = runtimeGlobal[CONTAINER_KEY];

  if (!container) {
    throw new Error('CommandDeck server container has not been initialized.');
  }

  return container;
}

export function getServerContainerIfInitialized(): ServerContainer | null {
  return runtimeGlobal[CONTAINER_KEY] ?? null;
}

export function unregisterServerContainer(container: ServerContainer): void {
  if (runtimeGlobal[CONTAINER_KEY] === container) {
    delete runtimeGlobal[CONTAINER_KEY];
  }
}
