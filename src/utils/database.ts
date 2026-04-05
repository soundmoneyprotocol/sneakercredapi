/**
 * Database connection and query utilities
 * Uses node-postgres (pg) for PostgreSQL connections
 */

import { Pool, PoolClient } from 'pg';
import { env } from '../config/env';
import logger from '../config/logger';

// Create a connection pool
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Connection event handlers
pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
});

pool.on('connect', () => {
  logger.info('New client connected to PostgreSQL');
});

/**
 * Execute a query
 */
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug(`Executed query in ${duration}ms`, { text, duration });
    return result;
  } catch (error) {
    logger.error('Database query error', { text, error });
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<PoolClient> {
  return await pool.connect();
}

/**
 * Close the pool
 */
export async function closePool() {
  await pool.end();
  logger.info('Database pool closed');
}

export { pool };
