import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { logger } from '../config/logger';
import { env } from '../config/env';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {

  // Log everything including the full error object
  logger.error('Request error', {
    message: err.message,
    name: err.name,
    stack: env.NODE_ENV === 'development' ? err.stack : undefined,
    method: req.method,
    path: req.path,
    body: req.body, // <-- this shows exactly what arrived
    ip: req.ip,
  });

  // Check by name string instead of instanceof — avoids module mismatch issues
  if (err.name === 'ZodError') {
    // Cast to any to access issues
    const zodErr = err as any;
    logger.error('Zod issues', { issues: zodErr.issues });

    res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: zodErr.issues?.map((issue: any) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  if ((err as any).code === '23505') {
    res.status(409).json({
      success: false,
      message: 'A record with this value already exists',
    });
    return;
  }

  if ((err as any).code === '23503') {
    res.status(400).json({
      success: false,
      message: 'Referenced record does not exist',
    });
    return;
  }

  res.status(500).json({
    success: false,
    message:
      env.NODE_ENV === 'development'
        ? err.message
        : 'An unexpected error occurred',
  });
};