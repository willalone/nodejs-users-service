import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { errorHandler } from './middleware/error-handler';
import { usersRouter } from './modules/users/users.routes';
import { notFound } from './utils/errors';

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/', (_req, res) => {
    res.json({
      service: 'users-service',
      docs: 'See README.md',
      endpoints: {
        health: 'GET /health',
        register: 'POST /api/v1/users/register',
        login: 'POST /api/v1/users/login',
        getUser: 'GET /api/v1/users/:id',
        listUsers: 'GET /api/v1/users',
        blockUser: 'PATCH /api/v1/users/:id/block',
      },
    });
  });

  app.use('/api/v1/users', usersRouter);

  app.use((_req, _res, next) => {
    next(notFound('Route not found'));
  });

  app.use(errorHandler);

  return app;
};
