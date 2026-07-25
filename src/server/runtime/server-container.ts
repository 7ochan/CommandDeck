import { CommandEventBus } from '../commands/command-events.js';
import { CommandDeckService } from '../commands/deck-service.js';
import { CommandHistoryService } from '../commands/history-service.js';
import { openCommandDeckDatabase } from '../db/client.js';
import { SqliteCommandDeckRepository } from '../db/repositories/command-deck-repository.js';
import { SqliteCommandHistoryRepository } from '../db/repositories/command-history-repository.js';
import { SqliteWorkspaceRepository } from '../db/repositories/workspace-repository.js';
import { SqliteWorkspaceTerminalStateRepository } from '../db/repositories/workspace-terminal-state-repository.js';
import { SqliteSettingsRepository } from '../db/repositories/settings-repository.js';
import { SettingsService } from '../settings/settings-service.js';
import { TerminalSessionManager } from '../terminal/terminal-session-manager.js';
import { TerminalGateway } from '../websocket/terminal-gateway.js';
import { WorkspaceService } from '../workspaces/workspace-service.js';
import { WorkspaceTerminalStateService } from '../workspace-terminal-state/workspace-terminal-state-service.js';
import { DEFAULT_WORKSPACE_ID } from '../../shared/types/workspace.js';
import {
  getServerContainerIfInitialized,
  registerServerContainer,
  unregisterServerContainer,
  type ServerContainer,
} from './server-container-registry.js';

export function initializeServerContainer(): ServerContainer {
  const existingContainer = getServerContainerIfInitialized();

  if (existingContainer) {
    return existingContainer;
  }

  const database = openCommandDeckDatabase();
  const historyRepository = new SqliteCommandHistoryRepository(database.orm);
  const deckRepository = new SqliteCommandDeckRepository(database.orm);
  const workspaceRepository = new SqliteWorkspaceRepository(database.orm);
  const workspaceService = new WorkspaceService(workspaceRepository);
  const settingsService = new SettingsService(
    new SqliteSettingsRepository(database.orm),
  );
  const workspaceTerminalStateService = new WorkspaceTerminalStateService(
    new SqliteWorkspaceTerminalStateRepository(database.orm),
  );
  const commandEvents = new CommandEventBus();
  const commandHistoryService = new CommandHistoryService(
    historyRepository,
    commandEvents,
  );
  const commandDeckService = new CommandDeckService(
    deckRepository,
    historyRepository,
  );
  const sessions = new TerminalSessionManager(
    undefined,
    commandEvents,
    DEFAULT_WORKSPACE_ID,
    workspaceTerminalStateService,
  );
  const terminalGateway = new TerminalGateway(sessions, workspaceService);
  let closed = false;

  const container: ServerContainer = {
    commandHistoryService,
    commandDeckService,
    workspaceService,
    settingsService,
    terminalGateway,
    databasePath: database.path,
    close: () => {
      if (closed) {
        return;
      }

      closed = true;
      commandHistoryService.close();
      commandEvents.clear();
      database.close();
      unregisterServerContainer(container);
    },
  };

  registerServerContainer(container);
  return container;
}
