/**
 * Global error handling middleware
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export const errorHandler = (
  error: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (error instanceof ApiError) {
    logger.warn({
      status: error.statusCode,
      code: error.code,
      message: error.message,
      path: req.path
    });

    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }

  // Unknown error
  logger.error({
    error: error.message,
    stack: error.stack,
    path: req.path
  });

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_SERVER_ERROR'
  });
};
