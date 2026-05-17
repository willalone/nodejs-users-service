import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { forbidden, unauthorized } from '../utils/errors';

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(forbidden('Insufficient permissions'));
      return;
    }
    next();
  };

export const requireSelfOrAdmin =
  (paramIdField = 'id') =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(unauthorized());
      return;
    }

    const targetId = req.params[paramIdField];
    const isSelf = req.user.id === targetId;
    const isAdmin = req.user.role === 'ADMIN';

    if (!isSelf && !isAdmin) {
      next(forbidden('You can only access your own profile'));
      return;
    }

    next();
  };
