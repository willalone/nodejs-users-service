import { z } from 'zod';
import { validateBirthDateString } from '../../utils/birth-date';

const fullNameSchema = z
  .string({ required_error: 'fullName is required' })
  .trim()
  .min(2, 'fullName must be at least 2 characters')
  .max(200, 'fullName must be at most 200 characters');

const emailSchema = z
  .string({ required_error: 'email is required' })
  .trim()
  .email('email must be a valid address')
  .max(255, 'email must be at most 255 characters');

const passwordSchema = z
  .string({ required_error: 'password is required' })
  .min(8, 'password must be at least 8 characters')
  .max(128, 'password must be at most 128 characters');
const birthDateSchema = z.string().superRefine((value, ctx) => {
  const message = validateBirthDateString(value);
  if (message) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  }
});

export const registerSchema = z.object({
  fullName: fullNameSchema,
  birthDate: birthDateSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ required_error: 'password is required' }).min(1, 'password is required'),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce
    .number({ invalid_type_error: 'page must be a number' })
    .int('page must be an integer')
    .positive('page must be greater than 0')
    .optional()
    .default(1),
  limit: z.coerce
    .number({ invalid_type_error: 'limit must be a number' })
    .int('limit must be an integer')
    .min(1, 'limit must be at least 1')
    .max(100, 'limit must be at most 100')
    .optional()
    .default(20),
});

export const userIdParamSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
