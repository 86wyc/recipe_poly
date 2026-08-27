import { Hono } from 'hono';
import { recipesRouter, recommendationRouter } from './routes/recipes';
import { errorHandler, notFoundHandler } from './errors';

export const app = new Hono();

// Global error handler (must be registered before routes)
app.onError(errorHandler);

// 404 handler
app.notFound(notFoundHandler);

// Health Check Route (NO DB required)
app.get('/health', (c) => c.json({ success: true, status: 'ok' }));

// Mount routers
app.route('/api/recipes', recipesRouter);
app.route('/api', recommendationRouter);
