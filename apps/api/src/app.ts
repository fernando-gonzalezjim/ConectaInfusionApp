import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { getStudioOverview } from './modules/studio/repository.js';
import { pool } from './db.js';

export const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json({ limit: '100kb' }));
app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/v1/ready', async (_req, res) => {
  try {
    await pool.query('SELECT 1 FROM class_sessions LIMIT 1');
    res.json({ status: 'ok', database: 'postgresql' });
  } catch { res.status(503).json({ status: 'unavailable', database: 'postgresql' }); }
});
app.get('/api/v1/studio/overview', async (_req, res) => {
  try { res.json(await getStudioOverview()); }
  catch { res.status(503).json({ error: 'Studio data is unavailable. Check the database connection and run migrations.' }); }
});
app.use((_req, res) => { res.status(404).json({ error: 'Route not found' }); });
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
  res.status(status >= 400 && status < 500 ? status : 500).json({ error: status >= 400 && status < 500 ? 'Invalid request' : 'Internal server error' });
});
