import { Pool, PoolClient, QueryResultRow} from 'pg';
import { env } from '../config/env';
import { logger } from '../config/logger';

// One pool shared across the entire app — never create multiple pools
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  min: env.DATABASE_POOL_MIN,   // keep this many connections warm
  max: env.DATABASE_POOL_MAX,   // never open more than this many
  idleTimeoutMillis: 30000,     // close idle connections after 30s
  connectionTimeoutMillis: 5000, // fail fast if can't connect in 5s
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Log pool-level events (helps debug connection issues)
pool.on('connect', () => {
  logger.debug('New database connection established');
});

pool.on('error', (err) => {
  logger.error('Unexpected database pool error', { error: err.message });
  process.exit(1); // Pool errors are unrecoverable — restart the process
});

// ── Main query function ───────────────────────────────────────────────────────
// Use this for single queries throughout the app
export const db = {
  // 2. Add 'extends QueryResultRow' to constrain the generic type T
  query: <T extends QueryResultRow = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ) => pool.query<T>(text, params),

  getClient: (): Promise<PoolClient> => pool.connect(),
};

// ── Transaction helper ────────────────────────────────────────────────────────
// Wraps multiple queries in a transaction — rolls back automatically on error
export const withTransaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err; // re-throw so the caller knows it failed
  } finally {
    client.release(); // always return the connection to the pool
  }
};

// ── Health check ──────────────────────────────────────────────────────────────
export const checkDatabaseConnection = async (): Promise<void> => {
  try {
    await pool.query('SELECT 1');
    logger.info('Database connected successfully');
  } catch (err) {
    logger.error('Database connection failed', { error: err });
    throw err;
  }
};