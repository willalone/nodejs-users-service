import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { unauthorized, forbidden } from '../utils/errors';
import { verifyAccessToken } from '../utils/jwt';

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(unauthorized('Bearer token required'));
    return;
  }

  const token = header.slice(7);

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user) {
      next(unauthorized('User not found'));
      return;
    }

    if (user.status === 'INACTIVE') {
      const isSelfBlockRequest =
        req.method === 'PATCH' &&
        req.params.id === user.id &&
        req.path.endsWith('/block');
      if (!isSelfBlockRequest) {
        next(forbidden('Account is blocked'));
        return;
      }
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    next();
  } catch {
    next(unauthorized('Invalid or expired token'));
  }
};
