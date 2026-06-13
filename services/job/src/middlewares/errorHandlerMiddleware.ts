import { Request, Response, NextFunction } from 'express';
import ErrorHandler from '../utils/errorHandler.js';

export const errorHandlerMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (error instanceof ErrorHandler) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  res.status(500).json({
    message: error.message,
  });
};
