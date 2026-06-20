import { Request, Response, NextFunction } from 'express';
import { CustomError } from './error.middleware';

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new CustomError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};

export default notFoundHandler;
