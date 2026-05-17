import type { Prisma, User } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export const usersRepository = {
  findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  },

  findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  create(data: Prisma.UserCreateInput): Promise<User> {
    return prisma.user.create({ data });
  },

  updateStatus(id: string, status: 'ACTIVE' | 'INACTIVE'): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { status },
    });
  },

  count(): Promise<number> {
    return prisma.user.count();
  },

  findManyPaginated(page: number, limit: number): Promise<{ users: User[]; total: number }> {
    const skip = (page - 1) * limit;
    return Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count(),
    ]).then(([users, total]) => ({ users, total }));
  },
};
