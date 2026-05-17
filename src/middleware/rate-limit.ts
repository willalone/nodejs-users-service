import rateLimit from 'express-rate-limit';
import { AppError } from '../utils/errors';

const rateLimitHandler = (_req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }): void => {
  const err = new AppError(429, 'Too many requests, try again later', 'TOO_MANY_REQUESTS');
  res.status(err.statusCode).json({
    error: { code: err.code, message: err.message },
  });
};

// register / login
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// остальные маршруты
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});
