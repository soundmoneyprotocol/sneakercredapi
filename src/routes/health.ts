/**
 * Health check endpoints
 */

import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

router.get('/db', (req: Request, res: Response) => {
  // TODO: Check database connection
  res.json({
    success: true,
    status: 'connected',
    database: 'PostgreSQL',
    timestamp: new Date().toISOString()
  });
});

router.get('/cache', (req: Request, res: Response) => {
  // TODO: Check Redis connection
  res.json({
    success: true,
    status: 'connected',
    cache: 'Redis',
    timestamp: new Date().toISOString()
  });
});

export default router;
