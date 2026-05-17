import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { logger } from '../src/utils/logger';

config();

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';
  const fullName = process.env.SEED_ADMIN_FULL_NAME ?? 'Админ Системный';
  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    logger.info({ email }, 'Admin already exists');
    return;
  }

  await prisma.user.create({
    data: {
      fullName,
      birthDate: new Date('1990-01-01'),
      email,
      password: await bcrypt.hash(password, rounds),
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  logger.info({ email }, 'Admin created');
}

main()
  .catch((e) => {
    logger.error(e, 'Seed failed');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
