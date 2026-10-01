import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { getStudioOverview } from './modules/studio/repository.js';
import { pool } from './db.js';
import { readPublicSettings } from './modules/foundation/settings.js';

export const app = express();
app.use(helmet());
const origins = (process.env.WEB_ORIGINS ?? process.env.WEB_ORIGIN ?? 'http://localhost:5173,http://localhost:5174').split(',').map(value => value.trim());
app.use(cors({ origin: origins }));
app.use(express.json({ limit: '100kb' }));
app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/v1/settings/public', async (_req, res) => {
  try { res.json(await readPublicSettings(pool)); }
  catch { res.status(503).json({ code: 'UNAVAILABLE' }); }
});
app.get('/api/v1/ready', async (_req, res) => {
  try {
    const settings = await pool.query('SELECT id FROM business_settings WHERE id=1');
    if (settings.rowCount !== 1) throw new Error('Required settings are missing');
    res.json({ status: 'ok', database: 'postgresql' });
  } catch { res.status(503).json({ status: 'unavailable', database: 'postgresql' }); }
});
app.get('/api/v1/studio/overview', async (_req, res) => {
  try { res.json(await getStudioOverview()); }
  catch { res.status(503).json({ code: 'UNAVAILABLE', error: 'Studio data is unavailable. Check the database connection and run migrations.' }); }
});
app.use((_req, res) => { res.status(404).json({ code: 'NOT_FOUND', error: 'Route not found' }); });
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
  res.status(status >= 400 && status < 500 ? status : 500).json({ code: status >= 400 && status < 500 ? 'INVALID_REQUEST' : 'INTERNAL_ERROR', error: status >= 400 && status < 500 ? 'Invalid request' : 'Internal server error' });
});
