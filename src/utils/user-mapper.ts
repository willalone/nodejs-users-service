import type { User } from '@prisma/client';

export type PublicUser = {
  id: string;
  fullName: string;
  birthDate: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
};

export const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  fullName: user.fullName,
  birthDate: user.birthDate.toISOString().slice(0, 10),
  email: user.email,
  role: user.role === 'ADMIN' ? 'admin' : 'user',
  status: user.status === 'ACTIVE' ? 'active' : 'inactive',
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
});
