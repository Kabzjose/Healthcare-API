import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';
import { logger } from '../config/logger';
import { env } from '../config/env';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction // must have 4 params — Express uses this to identify error middleware
): void => {

  // ── Log every error with context ───────────────────────────────────────────
  logger.error('Request error', {
    error: err.message,
    stack: env.NODE_ENV === 'development' ? err.stack : undefined,
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  // ── Zod validation errors (thrown by validate middleware) ──────────────────
  // These happen when request body fails schema validation
  if (err instanceof ZodError) {
  // Add this log line
  logger.error('Zod validation details', { issues: err.issues });

  res.status(422).json({
    success: false,
    message: 'Validation failed',
    errors: err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    })),
  });
  return;
}

  // ── Our custom ApiError ────────────────────────────────────────────────────
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  // ── PostgreSQL specific errors ─────────────────────────────────────────────
  if ((err as NodeJS.ErrnoException).code === '23505') {
    // Unique constraint violation — e.g. duplicate email on register
    res.status(409).json({
      success: false,
      message: 'A record with this value already exists',
    });
    return;
  }

  if ((err as NodeJS.ErrnoException).code === '23503') {
    // Foreign key violation — e.g. booking a slot that doesn't exist
    res.status(400).json({
      success: false,
      message: 'Referenced record does not exist',
    });
    return;
  }

  // ── Unknown / programmer errors ────────────────────────────────────────────
  // Never expose internal details to the client in production
  res.status(500).json({
    success: false,
    message:
      env.NODE_ENV === 'development'
        ? err.message // show real error locally
        : 'An unexpected error occurred', // hide it in production
  });
};