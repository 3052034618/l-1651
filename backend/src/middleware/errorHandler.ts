import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  details?: any;

  constructor(message: string, statusCode: number = 400, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'AppError';
  }
}

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      message: err.message,
      details: err.details,
    });
  }

  if (err.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2002') {
      const fields = err.meta?.target as string[];
      return res.status(400).json({
        message: `数据重复：${fields?.join(', ')} 已存在`,
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        message: '记录不存在',
      });
    }
  }

  res.status(500).json({
    message: '服务器内部错误',
  });
};
