import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { recipesRouter, recommendationRouter } from './routes/recipes';
import { errorHandler } from './errors';

const app = new Hono();

// Global CORS Middleware
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3001', 'http://localhost:3000'];

app.use(
  '*',
  cors({
    origin: (origin) => (allowedOrigins.includes(origin) ? origin : undefined),
    credentials: true,
  }),
);

// Base API Router
const api = new Hono();

// Health check endpoints
api.get('/', (c) => c.json({ status: 'ok', engine: 'Hono Serverless' }));
api.get('/health', (c) => c.json({ status: 'ok', engine: 'Hono Serverless' }));

// Attach entity routers to `api`
api.route('/recipes', recipesRouter);
api.route('/recommendations', recommendationRouter);
api.route('/substitutions', recommendationRouter);

// Mount router under BOTH `/api` and `/` to handle Vercel path stripping
app.route('/api', api);
app.route('/', api);

// Error handler
app.onError(errorHandler);

// Custom Not Found Handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: { message: `Route not found: ${c.req.method} ${c.req.path}` },
    },
    404,
  );
});

export default app;
