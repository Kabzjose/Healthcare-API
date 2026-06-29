import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ParsedQs } from 'qs'; // 1. Import ParsedQs from the query string utility library

export const validate = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
};

// For validating query params (e.g. ?page=1&limit=10)
export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      // 2. Cast the output to ParsedQs to satisfy Express
      req.query = schema.parse(req.query) as ParsedQs;
      next();
    } catch (err) {
      next(err);
    }
  };
};
