import { handle } from 'hono/vercel';
import { app } from '../src/api/app';

// Vercel serverless functions run on Node.js runtime by default.
// Edge runtime is incompatible with `pg` (node-postgres), so we explicitly use Node.js.
export const runtime = 'nodejs';

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
