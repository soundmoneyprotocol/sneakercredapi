/**
 * Environment configuration
 * Centralized management of environment variables
 */

import { z } from 'zod';

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_URL: z.string().default('http://localhost:3000'),
  CORS_ORIGIN: z.string().optional(),

  // Database
  DATABASE_URL: z.string(),
  DATABASE_SSL: z.string().optional(),

  // Cache
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Authentication
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRY: z.coerce.number().default(3600), // 1 hour in seconds
  REFRESH_TOKEN_EXPIRY: z.coerce.number().default(604800), // 7 days

  // External APIs
  FIRECRAWL_API_KEY: z.string().optional(),
  WEB3_PROVIDER_URL: z.string().optional(),
  CONTRACT_ADDRESS: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Rate limiting
  RATE_LIMIT_WINDOW: z.coerce.number().default(60000), // 1 minute
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
});

// Parse and validate environment variables
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

/**
 * Environment helper functions
 */
export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';
