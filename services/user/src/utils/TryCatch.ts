import { Request, Response, NextFunction, RequestHandler } from 'express';

export const TryCath = (
  controller: (req: Request, res: Response, next: NextFunction) => Promise<any>,
): RequestHandler => {
  return async (req, res, next) => {
    try {
      await controller(req, res, next);
    } catch (error: any) {
      next(error);
    }
  };
};
