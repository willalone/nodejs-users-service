import { config } from 'dotenv';

config();

const parseList = (raw: string | undefined): string[] =>
  (raw ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

// email админа и из RESERVED_ADMIN_EMAILS нельзя зарегистрировать повторно
export const getReservedRegistrationEmails = (): Set<string> => {
  const fromEnv = parseList(process.env.RESERVED_ADMIN_EMAILS);
  const seedAdmin = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const emails = [...fromEnv];
  if (seedAdmin) {
    emails.push(seedAdmin);
  }
  return new Set(emails);
};

export const isReservedRegistrationEmail = (email: string): boolean =>
  getReservedRegistrationEmails().has(email.toLowerCase());
