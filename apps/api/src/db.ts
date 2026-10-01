import 'dotenv/config';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Copy apps/api/.env.example to apps/api/.env and configure PostgreSQL.');

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  statement_timeout: 10000
});
pool.on('error', () => console.error('Unexpected PostgreSQL connection error'));
