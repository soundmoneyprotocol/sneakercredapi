/**
 * Authentication middleware
 * Verifies JWT tokens and attaches user info to request
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from './error';
import logger from '../config/logger';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Missing or invalid authorization header', 'AUTH_REQUIRED');
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string; email: string };
      req.userId = decoded.userId;
      req.user = {
        id: decoded.userId,
        email: decoded.email
      };
      next();
    } catch (error) {
      throw new ApiError(401, 'Invalid or expired token', 'INVALID_TOKEN');
    }
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    logger.error(error);
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      code: 'UNAUTHORIZED'
    });
  }
};

export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string; email: string };
      req.userId = decoded.userId;
      req.user = {
        id: decoded.userId,
        email: decoded.email
      };
    }
  } catch (error) {
    // Silent fail - continue without auth
  }

  next();
};
