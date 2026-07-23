import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { loadEnvFile } from 'node:process';
import next from 'next';

import {
  TerminalWebSocketServer,
  createTerminalSessionCookie,
  hasTerminalSessionCookie,
} from './src/server/websocket/websocket-server.js';

try {
  loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
    throw error;
  }
}

const isProduction = process.argv.includes('--production');
const dev = !isProduction;
const hostname = process.env.COMMANDDECK_HOST ?? '127.0.0.1';
const port = Number.parseInt(process.env.PORT ?? '3000', 10);

if (isProduction) {
  Reflect.set(process.env, 'NODE_ENV', 'production');
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const terminalSessionToken = randomBytes(32).toString('base64url');

await app.prepare();

const server = createServer((request, response) => {
  if (!hasTerminalSessionCookie(request.headers.cookie, terminalSessionToken)) {
    response.setHeader(
      'Set-Cookie',
      createTerminalSessionCookie(terminalSessionToken),
    );
  }

  void handle(request, response).catch((error: unknown) => {
    console.error('CommandDeck request error:', error);

    if (!response.headersSent) {
      response.writeHead(500).end('Internal server error');
    }
  });
});
const terminalWebSocketServer = new TerminalWebSocketServer({
  httpServer: server,
  sessionToken: terminalSessionToken,
});

server.on('error', (error) => {
  console.error('CommandDeck server error:', error);
  process.exitCode = 1;
});

server.listen(port, hostname, () => {
  console.log(`CommandDeck is ready at http://${hostname}:${port}`);
});

function shutdown(signal: NodeJS.Signals) {
  console.log(`Received ${signal}. Shutting down CommandDeck.`);
  terminalWebSocketServer.close();

  server.close((error) => {
    if (error) {
      console.error('CommandDeck shutdown error:', error);
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
