import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../config/env';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

export const signAccessToken = (payload: JwtPayload): string =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });

export const verifyAccessToken = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === 'string' || !decoded.sub || !decoded.email || !decoded.role) {
    throw new Error('Invalid token payload');
  }
  return {
    sub: decoded.sub,
    email: decoded.email as string,
    role: decoded.role as Role,
  };
};
