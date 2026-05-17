import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

const app = createApp();

describe('Users API', () => {
  let adminToken: string;
  let adminId: string;
  let userToken: string;
  let userId: string;

  beforeAll(async () => {
    await prisma.user.deleteMany();

    await request(app).post('/api/v1/users/register').send({
      fullName: 'Админ Тестов',
      birthDate: '1985-05-10',
      email: 'admin@test.local',
      password: 'Admin1234!',
    });

    const admin = await prisma.user.update({
      where: { email: 'admin@test.local' },
      data: { role: 'ADMIN' },
    });
    adminId = admin.id;

    const adminLogin = await request(app).post('/api/v1/users/login').send({
      email: 'admin@test.local',
      password: 'Admin1234!',
    });
    adminToken = adminLogin.body.data.accessToken;

    const reg = await request(app).post('/api/v1/users/register').send({
      fullName: 'Пользователь Обычный',
      birthDate: '1995-03-20',
      email: 'user@test.local',
      password: 'User1234!',
    });
    userId = reg.body.data.id;

    const userLogin = await request(app).post('/api/v1/users/login').send({
      email: 'user@test.local',
      password: 'User1234!',
    });
    userToken = userLogin.body.data.accessToken;

    expect(admin.id).toBeDefined();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects future birthDate on register', async () => {
    const res = await request(app).post('/api/v1/users/register').send({
      fullName: 'Иван Тестов',
      birthDate: '2099-12-31',
      email: 'future-top@test.local',
      password: 'User1234!',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toMatch(/future/i);
  });

  describe('pagination', () => {
    const listAsAdmin = (query: string) =>
      request(app)
        .get(`/api/v1/users?${query}`)
        .set('Authorization', `Bearer ${adminToken}`);

    it('returns 400 when page=0', async () => {
      const res = await listAsAdmin('page=0&limit=10');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when page is negative', async () => {
      const res = await listAsAdmin('page=-1&limit=10');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when page or limit is fractional', async () => {
      expect((await listAsAdmin('page=1.5&limit=10')).status).toBe(400);
      expect((await listAsAdmin('page=1&limit=2.5')).status).toBe(400);
    });

    it('returns 400 when limit is zero or above max (100)', async () => {
      expect((await listAsAdmin('page=1&limit=0')).status).toBe(400);
      expect((await listAsAdmin('page=1&limit=1000')).status).toBe(400);
    });

    it('returns 200 with meta when page and limit are valid', async () => {
      const res = await listAsAdmin('page=1&limit=2');
      expect(res.status).toBe(200);
      expect(res.body.meta).toMatchObject({ page: 1, limit: 2 });
      expect(res.body.data.length).toBeLessThanOrEqual(2);
    });

    it('returns all users when limit is larger than total', async () => {
      const probe = await listAsAdmin('page=1&limit=1');
      const { total } = probe.body.meta;
      expect(total).toBeGreaterThan(0);

      const res = await listAsAdmin('page=1&limit=100');
      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty('error');
      expect(res.body.data.length).toBe(total);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.meta).toMatchObject({
        page: 1,
        limit: 100,
        total,
        totalPages: 1,
      });
    });

    it('clamps page when page number is too high', async () => {
      const summary = await listAsAdmin('page=1&limit=2');
      const { total, totalPages } = summary.body.meta;
      expect(totalPages).toBeGreaterThanOrEqual(1);

      const beyond = await listAsAdmin(`page=${totalPages + 10}&limit=100`);
      expect(beyond.status).toBe(200);
      expect(beyond.body.meta.page).toBe(totalPages);
      expect(beyond.body.meta.totalPages).toBe(totalPages);
      expect(beyond.body.data.length).toBeGreaterThan(0);
      expect(beyond.body.data.length).toBeLessThanOrEqual(total);
    });

    it('returns fewer items than limit on the last page', async () => {
      const limit = 2;
      const summary = await listAsAdmin(`page=1&limit=${limit}`);
      let { total, totalPages } = summary.body.meta;

      if (total % limit === 0) {
        await request(app).post('/api/v1/users/register').send({
          fullName: 'Ещё один пользователь',
          birthDate: '1990-08-20',
          email: `pag-partial-${Date.now()}@test.local`,
          password: 'User1234!',
        });
        const updated = await listAsAdmin(`page=1&limit=${limit}`);
        total = updated.body.meta.total;
        totalPages = updated.body.meta.totalPages;
      }

      const last = await listAsAdmin(`page=${totalPages}&limit=${limit}`);
      const remainder = total - (totalPages - 1) * limit;

      expect(last.status).toBe(200);
      expect(last.body.meta.page).toBe(totalPages);
      expect(last.body.data.length).toBe(remainder);
      expect(remainder).toBeGreaterThan(0);
      expect(remainder).toBeLessThan(limit);
    });
  });

  describe('permissions', () => {
    it('forbids non-admin from listing users', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toEqual({
        code: 'FORBIDDEN',
        message: expect.any(String),
      });
    });

    it('rejects invalid user id in path', async () => {
      const res = await request(app)
        .get('/api/v1/users/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when user id does not exist', async () => {
      const res = await request(app)
        .get('/api/v1/users/00000000-0000-4000-8000-000000000099')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('forbids user from blocking another account', async () => {
      const res = await request(app)
        .patch(`/api/v1/users/${adminId}/block`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  it('registers user with role user and active status', async () => {
    const res = await request(app).post('/api/v1/users/register').send({
      fullName: 'Новый Юзер',
      birthDate: '2000-01-01',
      email: 'new@test.local',
      password: 'NewUser12!',
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      role: 'user',
      status: 'active',
      email: 'new@test.local',
    });
    expect(res.body.data).not.toHaveProperty('password');
  });

  it('rejects reserved admin email on register', async () => {
    const res = await request(app).post('/api/v1/users/register').send({
      fullName: 'Псевдо админ',
      birthDate: '1990-01-01',
      email: 'reserved-admin@test.local',
      password: 'User1234!',
    });
    expect(res.status).toBe(403);
  });

  it('rejects duplicate email', async () => {
    const res = await request(app).post('/api/v1/users/register').send({
      fullName: 'Дубль',
      birthDate: '2000-01-01',
      email: 'new@test.local',
      password: 'NewUser12!',
    });
    expect(res.status).toBe(409);
  });

  it('logs in and returns JWT', async () => {
    const res = await request(app).post('/api/v1/users/login').send({
      email: 'user@test.local',
      password: 'User1234!',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTypeOf('string');
    expect(res.body.data.tokenType).toBe('Bearer');
  });

  it('allows user to get self', async () => {
    const res = await request(app)
      .get(`/api/v1/users/${userId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(userId);
  });

  it('forbids user from reading another profile', async () => {
    const res = await request(app)
      .get(`/api/v1/users/${adminId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  it('allows admin to list users', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
  });

  it('allows admin to block another user', async () => {
    const reg = await request(app).post('/api/v1/users/register').send({
      fullName: 'Для блокировки админом',
      birthDate: '1991-06-01',
      email: 'victim@test.local',
      password: 'User1234!',
    });
    const victimId = reg.body.data.id;

    const res = await request(app)
      .patch(`/api/v1/users/${victimId}/block`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('inactive');
  });

  it('repeat block returns 200 and inactive user', async () => {
    const reg = await request(app).post('/api/v1/users/register').send({
      fullName: 'Повторная блокировка',
      birthDate: '1992-04-10',
      email: 'idempotent-block@test.local',
      password: 'User1234!',
    });
    const targetId = reg.body.data.id;
    const login = await request(app).post('/api/v1/users/login').send({
      email: 'idempotent-block@test.local',
      password: 'User1234!',
    });
    const token = login.body.data.accessToken;

    const first = await request(app)
      .patch(`/api/v1/users/${targetId}/block`)
      .set('Authorization', `Bearer ${token}`);
    expect(first.status).toBe(200);
    expect(first.body).not.toHaveProperty('error');
    expect(first.body.data).toMatchObject({
      id: targetId,
      status: 'inactive',
      email: 'idempotent-block@test.local',
      role: 'user',
    });

    const second = await request(app)
      .patch(`/api/v1/users/${targetId}/block`)
      .set('Authorization', `Bearer ${token}`);
    expect(second.status).toBe(200);
    expect(second.body).not.toHaveProperty('error');
    expect(second.body.data).toEqual(first.body.data);
  });

  it('blocked user cannot login', async () => {
    const res = await request(app).post('/api/v1/users/login').send({
      email: 'victim@test.local',
      password: 'User1234!',
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('wrong password returns generic 401', async () => {
    const res = await request(app).post('/api/v1/users/login').send({
      email: 'user@test.local',
      password: 'WrongPassword1!',
    });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('unknown email returns same 401 as wrong password', async () => {
    const res = await request(app).post('/api/v1/users/login').send({
      email: 'nobody@test.local',
      password: 'SomePass1!',
    });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('blocks user (self) and rejects login', async () => {
    const block = await request(app)
      .patch(`/api/v1/users/${userId}/block`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(block.status).toBe(200);
    expect(block.body.data.status).toBe('inactive');

    const login = await request(app).post('/api/v1/users/login').send({
      email: 'user@test.local',
      password: 'User1234!',
    });
    expect(login.status).toBe(401);
    expect(login.body.error.message).toBe('Invalid email or password');
  });

  describe('validation and auth errors', () => {
    it('returns 400 for malformed JSON body', async () => {
      const res = await request(app)
        .post('/api/v1/users/register')
        .set('Content-Type', 'application/json')
        .send('{"fullName":');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_JSON');
    });

    it('returns 400 when register body misses required fields', async () => {
      const res = await request(app).post('/api/v1/users/register').send({
        email: 'incomplete@test.local',
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when register password is too short', async () => {
      const res = await request(app).post('/api/v1/users/register').send({
        fullName: 'Короткий пароль',
        birthDate: '2000-01-01',
        email: 'short-pass@test.local',
        password: '123',
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toMatch(/password/i);
      expect(res.body.error.details.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'password', message: expect.any(String) }),
        ]),
      );
    });

    it('returns 401 for protected route without token', async () => {
      const res = await request(app).get(`/api/v1/users/${userId}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 400 when birthDate is unrealistically old', async () => {
      const res = await request(app).post('/api/v1/users/register').send({
        fullName: 'Слишком старый',
        birthDate: '1800-01-01',
        email: 'old@test.local',
        password: 'User1234!',
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when user is younger than minimum age', async () => {
      const res = await request(app).post('/api/v1/users/register').send({
        fullName: 'Ребёнок',
        birthDate: '2020-01-01',
        email: 'young@test.local',
        password: 'User1234!',
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 401 for list users without token', async () => {
      const res = await request(app).get('/api/v1/users');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 for block without token', async () => {
      const res = await request(app).patch(`/api/v1/users/${adminId}/block`);
      expect(res.status).toBe(401);
    });

    it('returns 400 for block with invalid UUID', async () => {
      const res = await request(app)
        .patch('/api/v1/users/not-a-uuid/block')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });

    it('returns 401 for invalid JWT', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${userId}`)
        .set('Authorization', 'Bearer not-a-jwt');
      expect(res.status).toBe(401);
    });

    it('returns 400 for login with invalid email format', async () => {
      const res = await request(app).post('/api/v1/users/login').send({
        email: 'not-email',
        password: 'User1234!',
      });
      expect(res.status).toBe(400);
    });

  });
});
