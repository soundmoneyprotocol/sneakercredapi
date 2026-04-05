/**
 * SneakerCred Unified API Server
 * Main entry point for all microservices
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import logger from './config/logger';
import { errorHandler } from './middleware/error';
import { requestLogger } from './middleware/logging';
import { authMiddleware } from './middleware/auth';

// Routes
import authRoutes from './routes/auth';
import marketplaceRoutes from './routes/marketplace';
import gameRoutes from './routes/game';
import sneakersRoutes from './routes/sneakers';
import nftRoutes from './routes/nft';
import shopifyRoutes from './routes/shopify';
import healthRoutes from './routes/health';

// Initialize Express app
const app = express();
const port = env.PORT;

// Middleware
app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGIN || ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use(requestLogger);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/sneakers', sneakersRoutes);
app.use('/api/nft', authMiddleware, nftRoutes);  // NFT routes require auth
app.use('/api/shopify', shopifyRoutes);
app.use('/health', healthRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'SneakerCred API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      marketplace: '/api/marketplace',
      game: '/api/game',
      sneakers: '/api/sneakers',
      nft: '/api/nft',
      shopify: '/api/shopify',
      health: '/health'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(port, () => {
  logger.info(`🚀 SneakerCred API running on http://localhost:${port}`);
  logger.info(`Environment: ${env.NODE_ENV}`);
  logger.info(`Database: ${env.DATABASE_URL.split('@')[1]}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;
