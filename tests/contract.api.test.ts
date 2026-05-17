import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

const app = createApp();

let emailSeq = 0;
const uniqueEmail = (label: string) => `contract-${label}-${++emailSeq}@test.local`;

const publicUserShape = {
  id: expect.stringMatching(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  ),
  fullName: expect.any(String),
  birthDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
  email: expect.any(String),
  role: expect.stringMatching(/^(admin|user)$/),
  status: expect.stringMatching(/^(active|inactive)$/),
  createdAt: expect.any(String),
  updatedAt: expect.any(String),
};

describe('API contract', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany();
  });

  it('register validation error has details.fields', async () => {
    const res = await request(app).post('/api/v1/users/register').send({
      fullName: 'Test',
      birthDate: '2000-01-01',
      email: uniqueEmail('validation'),
      password: 'short',
    });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
        details: {
          fields: expect.arrayContaining([
            expect.objectContaining({
              field: expect.any(String),
              code: expect.any(String),
              message: expect.any(String),
            }),
          ]),
          fieldErrors: expect.any(Object),
          formErrors: expect.any(Array),
        },
      },
    });
  });

  it('missing token returns 401', async () => {
    const res = await request(app).get('/api/v1/users/00000000-0000-4000-8000-000000000001');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: expect.any(String),
      },
    });
  });

  it('block with invalid JWT returns 401', async () => {
    const email = uniqueEmail('block-bad-jwt');
    const reg = await request(app).post('/api/v1/users/register').send({
      fullName: 'Block JWT',
      birthDate: '1992-01-01',
      email,
      password: 'User1234!',
    });
    expect(reg.status).toBe(201);

    const res = await request(app)
      .patch(`/api/v1/users/${reg.body.data.id}/block`)
      .set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: expect.any(String),
      },
    });
  });

  it('malformed JSON returns INVALID_JSON', async () => {
    const res = await request(app)
      .post('/api/v1/users/register')
      .set('Content-Type', 'application/json')
      .send('{');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('future birthDate returns VALIDATION_ERROR', async () => {
    const res = await request(app).post('/api/v1/users/register').send({
      fullName: 'Future',
      birthDate: '2099-01-01',
      email: uniqueEmail('future'),
      password: 'User1234!',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
      }),
    );
  });

  it('invalid user id returns validation error', async () => {
    const email = uniqueEmail('uuid');
    await request(app).post('/api/v1/users/register').send({
      fullName: 'UUID Contract',
      birthDate: '1995-01-01',
      email,
      password: 'User1234!',
    });
    const login = await request(app).post('/api/v1/users/login').send({
      email,
      password: 'User1234!',
    });
    const token = login.body.data.accessToken;

    const res = await request(app)
      .get('/api/v1/users/not-a-uuid')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
        details: {
          fields: expect.arrayContaining([
            expect.objectContaining({ field: 'id', code: expect.any(String) }),
          ]),
        },
      },
    });
  });

  describe('success responses', () => {
    it('register returns user without password', async () => {
      const res = await request(app).post('/api/v1/users/register').send({
        fullName: 'Contract Register',
        birthDate: '1995-06-01',
        email: uniqueEmail('register'),
        password: 'User1234!',
      });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        data: expect.objectContaining(publicUserShape),
      });
      expect(res.body.data).not.toHaveProperty('password');
    });

    it('login returns token and user', async () => {
      const email = uniqueEmail('login');
      await request(app).post('/api/v1/users/register').send({
        fullName: 'Contract Login',
        birthDate: '1994-01-01',
        email,
        password: 'User1234!',
      });
      const res = await request(app).post('/api/v1/users/login').send({
        email,
        password: 'User1234!',
      });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        accessToken: expect.any(String),
        tokenType: 'Bearer',
        user: expect.objectContaining(publicUserShape),
      });
    });

    it('get user by id', async () => {
      const email = uniqueEmail('get-by-id');
      const reg = await request(app).post('/api/v1/users/register').send({
        fullName: 'Contract GetById',
        birthDate: '1993-02-02',
        email,
        password: 'User1234!',
      });
      expect(reg.status).toBe(201);
      const login = await request(app).post('/api/v1/users/login').send({
        email,
        password: 'User1234!',
      });
      const id = reg.body.data.id;
      const res = await request(app)
        .get(`/api/v1/users/${id}`)
        .set('Authorization', `Bearer ${login.body.data.accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(reg.body.data);
    });

    it('list users returns data and meta', async () => {
      const email = uniqueEmail('admin-list');
      await request(app).post('/api/v1/users/register').send({
        fullName: 'Contract Admin',
        birthDate: '1990-01-01',
        email,
        password: 'User1234!',
      });
      await prisma.user.update({
        where: { email },
        data: { role: 'ADMIN' },
      });
      const login = await request(app).post('/api/v1/users/login').send({
        email,
        password: 'User1234!',
      });

      const res = await request(app)
        .get('/api/v1/users?page=1&limit=10')
        .set('Authorization', `Bearer ${login.body.data.accessToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0]).toEqual(expect.objectContaining(publicUserShape));
      expect(res.body.meta).toMatchObject({
        page: expect.any(Number),
        limit: expect.any(Number),
        total: expect.any(Number),
        totalPages: expect.any(Number),
      });
    });

    it('block sets status inactive', async () => {
      const email = uniqueEmail('block');
      const reg = await request(app).post('/api/v1/users/register').send({
        fullName: 'Contract Block',
        birthDate: '1991-03-03',
        email,
        password: 'User1234!',
      });
      expect(reg.status).toBe(201);
      const login = await request(app).post('/api/v1/users/login').send({
        email,
        password: 'User1234!',
      });
      const id = reg.body.data.id;

      const res = await request(app)
        .patch(`/api/v1/users/${id}/block`)
        .set('Authorization', `Bearer ${login.body.data.accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        id,
        status: 'inactive',
      });
    });
  });

  it('missing user returns 404', async () => {
    const email = uniqueEmail('admin-404');
    await request(app).post('/api/v1/users/register').send({
      fullName: 'Admin 404',
      birthDate: '1990-01-01',
      email,
      password: 'User1234!',
    });
    await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
    const login = await request(app).post('/api/v1/users/login').send({
      email,
      password: 'User1234!',
    });

    const res = await request(app)
      .get('/api/v1/users/00000000-0000-4000-8000-000000000099')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: expect.any(String),
      },
    });
  });

  it('user cannot list all users (requireRole)', async () => {
    const email = uniqueEmail('list-forbidden');
    await request(app).post('/api/v1/users/register').send({
      fullName: 'List Contract',
      birthDate: '1995-01-01',
      email,
      password: 'User1234!',
    });
    const login = await request(app).post('/api/v1/users/login').send({
      email,
      password: 'User1234!',
    });
    const token = login.body.data.accessToken;

    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      error: {
        code: 'FORBIDDEN',
        message: expect.any(String),
      },
    });
  });

  it('user cannot block another profile', async () => {
    const blocker = uniqueEmail('blocker');
    const target = uniqueEmail('target');
    await request(app).post('/api/v1/users/register').send({
      fullName: 'Blocker',
      birthDate: '1991-01-01',
      email: blocker,
      password: 'User1234!',
    });
    const reg = await request(app).post('/api/v1/users/register').send({
      fullName: 'Target',
      birthDate: '1992-02-02',
      email: target,
      password: 'User1234!',
    });
    const login = await request(app).post('/api/v1/users/login').send({
      email: blocker,
      password: 'User1234!',
    });

    const res = await request(app)
      .patch(`/api/v1/users/${reg.body.data.id}/block`)
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
