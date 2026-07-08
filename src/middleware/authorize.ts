import { Response, NextFunction, RequestHandler } from 'express';
import { UserRole, AuthenticatedRequest } from '../types';
import { ApiError } from '../utils/ApiError';

// Factory — takes allowed roles, returns middleware
// Usage: authorize('admin') or authorize('doctor', 'admin')
export const authorize = (...allowedRoles: UserRole[]): RequestHandler => {
  return (req, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    // authenticate must run before authorize — req.user must exist
    if (!authReq.user) {
      next(ApiError.unauthorized());
      return;
    }

    if (authReq.user.role !== 'admin' && !allowedRoles.includes(authReq.user.role)) {
      next(
        ApiError.forbidden(
          `Access denied. Required role: ${allowedRoles.join(' or ')}`
        )
      );
      return;
    }

    next();
  };
};