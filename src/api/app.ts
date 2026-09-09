import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { recipesRouter, recommendationRouter } from './routes/recipes';
import { errorHandler } from './errors';

const app = new Hono();

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

// Health checks
app.get('/', (c) => c.json({ status: 'ok', engine: 'Hono Serverless' }));
app.get('/api', (c) => c.json({ status: 'ok', engine: 'Hono Serverless' }));

// API sub-router
const api = new Hono();

api.get('/', (c) => c.json({ status: 'ok', engine: 'Hono Serverless' }));
api.get('/health', (c) => c.json({ status: 'ok', engine: 'Hono Serverless' }));

// Mount recipes under /recipes
api.route('/recipes', recipesRouter);

// Mount recommendation router at root of api router
// because recommendationRouter already contains '/recommendations' and '/substitutions'
api.route('/', recommendationRouter);

// Mount under both /api and root for Vercel path-stripping compatibility
app.route('/api', api);
app.route('/', api);

app.onError(errorHandler);

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
