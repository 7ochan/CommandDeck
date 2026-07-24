import { CommandEventBus } from '../commands/command-events.js';
import { CommandDeckService } from '../commands/deck-service.js';
import { CommandHistoryService } from '../commands/history-service.js';
import { openCommandDeckDatabase } from '../db/client.js';
import { SqliteCommandDeckRepository } from '../db/repositories/command-deck-repository.js';
import { SqliteCommandHistoryRepository } from '../db/repositories/command-history-repository.js';
import { TerminalSessionManager } from '../terminal/terminal-session-manager.js';
import { TerminalGateway } from '../websocket/terminal-gateway.js';
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
  const commandEvents = new CommandEventBus();
  const commandHistoryService = new CommandHistoryService(
    historyRepository,
    commandEvents,
  );
  const commandDeckService = new CommandDeckService(
    deckRepository,
    historyRepository,
  );
  const sessions = new TerminalSessionManager(undefined, commandEvents);
  const terminalGateway = new TerminalGateway(sessions);
  let closed = false;

  const container: ServerContainer = {
    commandHistoryService,
    commandDeckService,
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
