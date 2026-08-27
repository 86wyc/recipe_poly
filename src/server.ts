import 'dotenv/config';
import { serve } from '@hono/node-server';
import { app } from './api/app';
import { closeDatabaseConnection } from './db/connection';

const port = Number(process.env.PORT ?? 3000);

const server = serve({
  fetch: app.fetch,
  port,
});

console.log(`[API] Listening on http://localhost:${port}`);

async function shutdown(signal: string) {
  console.log(`[API] Received ${signal}, shutting down...`);
  await closeDatabaseConnection();
  server.close();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
