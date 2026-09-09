import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { recipesRouter, recommendationRouter } from './routes/recipes';

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

api.route('/recipes', recipesRouter);
api.route('/', recommendationRouter);

app.route('/api', api);
app.route('/', api);

// Temporary detailed error handler to expose underlying database errors
app.onError((err, c) => {
  console.error('SERVER ERROR:', err);
  return c.json(
    {
      success: false,
      error: {
        message: err.message || 'Internal Server Error',
        cause: (err as any).cause?.message || (err as any).cause || undefined,
        stack: process.env.NODE_ENV === 'production' ? err.stack : undefined,
      },
    },
    500,
  );
});;

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
