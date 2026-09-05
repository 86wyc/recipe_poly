import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { recipesRouter, recommendationRouter } from './routes/recipes';
import { errorHandler, notFoundHandler } from './errors';

export const app = new Hono();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3001', 'http://localhost:3000'];

app.use(
  '/api/*',
  cors({
    origin: (origin) => (allowedOrigins.includes(origin) ? origin : undefined),
    credentials: true,
  }),
);

app.onError(errorHandler);
app.notFound(notFoundHandler);

app.route('/api/recipes', recipesRouter);
app.route('/api', recommendationRouter);
