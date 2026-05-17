import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { formatZodError } from '../utils/format-zod-error';
import { logger } from '../utils/logger';
import { env } from '../config/env';

const isInvalidJsonBody = (err: unknown): boolean =>
  err instanceof SyntaxError &&
  'status' in err &&
  (err as SyntaxError & { status: number }).status === 400 &&
  'body' in err;

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code ?? 'APP_ERROR',
        message: err.message,
      },
    });
    return;
  }

  if (isInvalidJsonBody(err)) {
    res.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'Request body must be valid JSON',
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    const { message, details } = formatZodError(err);
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message,
        details,
      },
    });
    return;
  }

  if (env.NODE_ENV !== 'test') {
    logger.error({ err }, 'Unhandled error');
  }

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  });
};
