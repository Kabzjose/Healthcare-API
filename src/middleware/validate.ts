import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny } from 'zod';

type RequestPayload = {
  body: unknown;
  params: unknown;
  query: unknown;
};

const runValidation = (
  schema: ZodTypeAny,
  payload: unknown
): { body?: unknown; params?: unknown; query?: unknown } | null => {
  const result = schema.safeParse(payload);

  if (!result.success) {
    return null;
  }

  return result.data as { body?: unknown; params?: unknown; query?: unknown };
};

const applyValidatedData = (
  req: Request,
  validated: { body?: unknown; params?: unknown; query?: unknown }
): void => {
  if (validated.body !== undefined) req.body = validated.body;
  if (validated.params !== undefined) req.params = validated.params as Record<string, string>;
  if (validated.query !== undefined) {
    const currentQuery = req.query as Record<string, unknown>;

    for (const key of Object.keys(currentQuery)) {
      delete currentQuery[key];
    }

    Object.assign(currentQuery, validated.query as Record<string, unknown>);
  }
};

const createValidator = (
  schema: ZodTypeAny,
  source: 'body' | 'query' | 'params' | 'request'
) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const payloads: Record<typeof source, unknown> = {
        body: req.body,
        query: req.query,
        params: req.params,
        request: {
          body: req.body,
          params: req.params,
          query: req.query,
        } satisfies RequestPayload,
      };

      const preferred = runValidation(schema, payloads[source]);

      if (preferred) {
        if (source === 'request') {
          applyValidatedData(req, preferred);
        } else {
          if (source === 'body') req.body = preferred as Request['body'];
          if (source === 'query') {
            const currentQuery = req.query as Record<string, unknown>;

            for (const key of Object.keys(currentQuery)) {
              delete currentQuery[key];
            }

            Object.assign(currentQuery, preferred as Record<string, unknown>);
          }
          if (source === 'params') req.params = preferred as Request['params'];
        }
        next();
        return;
      }

      if (source === 'request') {
        const fallback = runValidation(schema, req.body);

        if (fallback) {
          applyValidatedData(req, fallback);
          next();
          return;
        }
      }

      next(new Error('Validation failed'));
    } catch (err) {
      next(err);
    }
  };
};

export const validate = (schema: ZodTypeAny) => createValidator(schema, 'request');

export const validateBody = (schema: ZodTypeAny) => createValidator(schema, 'body');

export const validateQuery = (schema: ZodTypeAny) => createValidator(schema, 'query');

export const validateParams = (schema: ZodTypeAny) => createValidator(schema, 'params');