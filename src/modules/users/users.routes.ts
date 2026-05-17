import { Router } from 'express';
import { apiRateLimiter, authRateLimiter } from '../../middleware/rate-limit';
import { authenticate } from '../../middleware/authenticate';
import { requireRole, requireSelfOrAdmin } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { usersController } from './users.controller';
import {
  listUsersQuerySchema,
  loginSchema,
  registerSchema,
  userIdParamSchema,
} from './users.schema';

export const usersRouter = Router();

usersRouter.use(apiRateLimiter);

usersRouter.post('/register', authRateLimiter, validate(registerSchema), usersController.register);
usersRouter.post('/login', authRateLimiter, validate(loginSchema), usersController.login);

usersRouter.get(
  '/',
  authenticate,
  requireRole('ADMIN'),
  validate(listUsersQuerySchema, 'query'),
  usersController.list,
);

usersRouter.get(
  '/:id',
  authenticate,
  validate(userIdParamSchema, 'params'),
  requireSelfOrAdmin('id'),
  usersController.getById,
);

usersRouter.patch(
  '/:id/block',
  authenticate,
  validate(userIdParamSchema, 'params'),
  requireSelfOrAdmin('id'),
  usersController.block,
);
