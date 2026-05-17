import type { NextFunction, Request, Response } from 'express';
import { usersService } from './users.service';

export const usersController = {
  register: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await usersService.register(req.body);
      res.status(201).json({ data: user });
    } catch (err) {
      next(err);
    }
  },

  login: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await usersService.login(req.body);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const user = await usersService.getById(id);
      res.status(200).json({ data: user });
    } catch (err) {
      next(err);
    }
  },

  list: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit } = req.validatedQuery as { page: number; limit: number };
      const result = await usersService.list(page, limit);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  block: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const user = await usersService.block(id, req.user!.id, req.user!.role);
      res.status(200).json({ data: user });
    } catch (err) {
      next(err);
    }
  },
};
