export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (message = 'Not found') => new AppError(404, message, 'NOT_FOUND');
export const unauthorized = (message = 'Unauthorized') =>
  new AppError(401, message, 'UNAUTHORIZED');
export const forbidden = (message = 'Forbidden') => new AppError(403, message, 'FORBIDDEN');
export const conflict = (message = 'Conflict') => new AppError(409, message, 'CONFLICT');
export const badRequest = (message = 'Bad request') => new AppError(400, message, 'BAD_REQUEST');
