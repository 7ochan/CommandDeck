import { CommandEventBus } from '../commands/command-events.js';
import { CommandService } from '../commands/command-service.js';
import { openCommandDeckDatabase } from '../db/client.js';
import { SqliteCommandCardRepository } from '../db/repositories/command-card-repository.js';
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
  const repository = new SqliteCommandCardRepository(database.orm);
  const commandEvents = new CommandEventBus();
  const commandService = new CommandService(repository, commandEvents);
  const sessions = new TerminalSessionManager(undefined, commandEvents);
  const terminalGateway = new TerminalGateway(sessions);
  let closed = false;

  const container: ServerContainer = {
    commandService,
    terminalGateway,
    databasePath: database.path,
    close: () => {
      if (closed) {
        return;
      }

      closed = true;
      commandService.close();
      commandEvents.clear();
      database.close();
      unregisterServerContainer(container);
    },
  };

  registerServerContainer(container);
  return container;
}
