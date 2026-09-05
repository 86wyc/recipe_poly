import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { recipesRouter, recommendationRouter } from './routes/recipes';
import { errorHandler, notFoundHandler } from './errors';

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

// Health checks
app.get('/', (c) => c.json({ status: 'ok', engine: 'Hono Serverless' }));
app.get('/api', (c) => c.json({ status: 'ok', engine: 'Hono Serverless' }));

// Base API router
const api = new Hono();
api.route('/recipes', recipesRouter);
api.route('/recommendations', recommendationRouter);
api.route('/substitutions', recommendationRouter); // Note: ensure route paths are correct

// Mount under BOTH /api and root to handle Vercel path stripping
app.route('/api', api);
app.route('/', api);

app.onError(errorHandler);
app.notFound(notFoundHandler);

export default app;
