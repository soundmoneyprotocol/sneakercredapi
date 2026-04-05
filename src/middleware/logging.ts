/**
 * Request logging middleware
 * Logs all incoming requests
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Add request ID
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  // Log request
  logger.info({
    request_id: requestId,
    method: req.method,
    path: req.path,
    ip: req.ip
  }, `${req.method} ${req.path}`);

  // Capture response
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    logger.info({
      request_id: requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
      ip: req.ip
    }, `${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    return originalSend.call(this, data);
  };

  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);

  next();
};
