import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';

config({ path: '.env.test', override: true });

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'file:./test.db';
process.env.JWT_SECRET ??= 'test-jwt-secret-min-16-chars';
process.env.JWT_EXPIRES_IN ??= '1h';
process.env.SEED_ADMIN_EMAIL ??= 'reserved-admin@test.local';
process.env.BCRYPT_ROUNDS ??= '12';

const dbPath = path.resolve('test.db');
for (const file of [dbPath, `${dbPath}-journal`]) {
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
}

execSync('npx prisma db push --skip-generate', {
  stdio: 'inherit',
  env: process.env,
});
