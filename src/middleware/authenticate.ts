import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { AuthenticatedRequest, JwtPayload } from '../types';

export const authenticate = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  try {
    // ── Extract token from header ────────────────────────────────────────────
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('No token provided');
    }

    const token = authHeader.split(' ')[1]; // "Bearer <token>" → "<token>"

    if (!token) {
      throw ApiError.unauthorized('No token provided');
    }

    // ── Verify token signature and expiry ────────────────────────────────────
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // ── Attach user to request — available in all downstream middleware ───────
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (err) {
    // jwt.verify throws specific errors we can give better messages for
    if (err instanceof jwt.TokenExpiredError) {
      next(ApiError.unauthorized('Token has expired'));
      return;
    }
    if (err instanceof jwt.JsonWebTokenError) {
      next(ApiError.unauthorized('Invalid token'));
      return;
    }
    next(err);
  }
};