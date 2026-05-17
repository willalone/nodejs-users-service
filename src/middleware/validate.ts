import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

type RequestSlice = 'body' | 'query' | 'params';

export const validate =
  (schema: ZodSchema, slice: RequestSlice = 'body') =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[slice]);

    if (!result.success) {
      next(result.error);
      return;
    }

    if (slice === 'query') {
      req.validatedQuery = result.data as Record<string, unknown>;
    } else {
      req[slice] = result.data;
    }

    next();
  };
