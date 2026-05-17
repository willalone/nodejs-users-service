import { isReservedRegistrationEmail } from '../../config/reserved-emails';
import { conflict, forbidden, notFound, unauthorized } from '../../utils/errors';
import { hashPassword, verifyPassword } from '../../utils/password';
import { signAccessToken } from '../../utils/jwt';
import { toPublicUser } from '../../utils/user-mapper';
import { usersRepository } from './users.repository';
import type { LoginInput, RegisterInput } from './users.schema';

const parseBirthDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

export const usersService = {
  async register(input: RegisterInput) {
    const email = input.email.toLowerCase();

    if (isReservedRegistrationEmail(email)) {
      throw forbidden('This email is reserved and cannot be used for registration');
    }

    const existing = await usersRepository.findByEmail(email);
    if (existing) {
      throw conflict('Email already registered');
    }

    const user = await usersRepository.create({
      fullName: input.fullName,
      birthDate: parseBirthDate(input.birthDate),
      email,
      password: await hashPassword(input.password),
      role: 'USER',
      status: 'ACTIVE',
    });

    return toPublicUser(user);
  },

  async login(input: LoginInput) {
    const user = await usersRepository.findByEmail(input.email.toLowerCase());
    const invalidCredentials = () => unauthorized('Invalid email or password');

    if (!user) {
      throw invalidCredentials();
    }

    const valid = await verifyPassword(input.password, user.password);
    if (!valid || user.status === 'INACTIVE') {
      throw invalidCredentials();
    }

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      accessToken,
      tokenType: 'Bearer' as const,
      user: toPublicUser(user),
    };
  },

  async getById(id: string) {
    const user = await usersRepository.findById(id);
    if (!user) {
      throw notFound('User not found');
    }
    return toPublicUser(user);
  },

  async list(page: number, limit: number) {
    const total = await usersRepository.count();
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const effectivePage = totalPages === 0 ? 1 : Math.min(page, totalPages);

    const { users } = await usersRepository.findManyPaginated(effectivePage, limit);

    return {
      data: users.map(toPublicUser),
      meta: {
        page: effectivePage,
        limit,
        total,
        totalPages,
      },
    };
  },

  async block(targetId: string, actorId: string, actorRole: 'ADMIN' | 'USER') {
    if (actorId !== targetId && actorRole !== 'ADMIN') {
      throw forbidden('You can only block yourself or be an admin');
    }

    const user = await usersRepository.findById(targetId);
    if (!user) {
      throw notFound('User not found');
    }

    if (user.status === 'INACTIVE') {
      return toPublicUser(user);
    }

    const updated = await usersRepository.updateStatus(targetId, 'INACTIVE');
    return toPublicUser(updated);
  },
};
