import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ZodError } from 'zod';

// ============================================================================
// ApiError Class
// ============================================================================

export class ApiError extends Error {
  constructor(
    public readonly statusCode: ContentfulStatusCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    // Fix prototype chain for proper instanceof checks
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// ============================================================================
// PostgreSQL Error Detection Helpers
// ============================================================================

interface PgError extends Error {
  code?: string;
  constraint?: string;
}

function isPgUniqueViolation(error: unknown): error is PgError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as PgError).code === '23505'
  );
}

function isPgForeignKeyViolation(error: unknown): error is PgError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as PgError).code === '23503'
  );
}

// ============================================================================
// Hono Error Middleware
// ============================================================================

export async function errorHandler(err: Error, c: Context): Promise<Response> {
  // Custom API errors
  if (err instanceof ApiError) {
    return c.json(
      {
        success: false,
        error: {
          message: err.message,
          details: err.details,
        },
      },
      err.statusCode,
    );
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    return c.json(
      {
        success: false,
        error: {
          message: 'Validation failed',
          details: err.flatten(),
        },
      },
      400,
    );
  }

  // PostgreSQL unique constraint violation
  if (isPgUniqueViolation(err)) {
    return c.json(
      {
        success: false,
        error: {
          message: 'Resource already exists',
          constraint: err.constraint,
        },
      },
      409,
    );
  }

  // PostgreSQL foreign key violation
  if (isPgForeignKeyViolation(err)) {
    return c.json(
      {
        success: false,
        error: {
          message: 'Referenced resource does not exist',
          constraint: err.constraint,
        },
      },
      422,
    );
  }

  // Unexpected error — log for debugging
console.error('[API] Unhandled error:', {
  name: err.name,
  message: err.message,
  stack: err.stack,
  cause: (err as any).cause,
});  

  return c.json(
    {
      success: false,
      error: {
        message: 'Internal Server Error',
      },
    },
    500,
  );
}

// ============================================================================
// Hono Not Found Handler
// ============================================================================

export async function notFoundHandler(c: Context): Promise<Response> {
  return c.json(
    {
      success: false,
      error: {
        message: `Route not found: ${c.req.method} ${c.req.path}`,
      },
    },
    404,
  );
}
