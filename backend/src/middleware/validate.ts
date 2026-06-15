import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { AppError } from './errorHandler';

export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((e: any) => ({
      field: e.path,
      message: e.msg,
    }));
    return next(new AppError('参数验证失败', 400, errorMessages));
  }
  next();
};
