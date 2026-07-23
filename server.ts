import { createServer } from 'node:http';

const isProduction = process.argv.includes('--production');
const dev = !isProduction;
const hostname = process.env.HOSTNAME ?? '127.0.0.1';
const port = Number.parseInt(process.env.PORT ?? '3000', 10);

if (isProduction) {
  process.env.NODE_ENV = 'production';
}

const { default: next } = await import('next');
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const server = createServer((request, response) => {
  void handle(request, response);
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

  server.close((error) => {
    if (error) {
      console.error('CommandDeck shutdown error:', error);
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
