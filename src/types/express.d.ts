import type { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  status: 'ACTIVE' | 'INACTIVE';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      validatedQuery?: Record<string, unknown>;
    }
  }
}

export {};
