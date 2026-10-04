import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { getStudioOverview } from './modules/studio/repository.js';
import { pool } from './db.js';
import { readPublicSettings } from './modules/foundation/settings.js';
import type { Pool } from 'pg';
import { readIdentityConfig, type IdentityConfig } from './modules/identity/config.js';
import { createSessionService } from './modules/identity/sessions.js';
import { createAuthRouter } from './modules/identity/auth-routes.js';
import { createCsrfProtection } from './modules/identity/csrf.js';
import { createManagementRouter } from './modules/identity/authorization.js';
import { createRegistrationService } from './modules/identity/registration.js';
import { createRecoveryService } from './modules/identity/recovery.js';
import { createAccountInvitationService } from './modules/identity/account-invitations.js';
import { createAccountRouter } from './modules/identity/account-routes.js';
import { createAccountService } from './modules/identity/accounts.js';
import { createRoleService } from './modules/identity/roles.js';

export async function createApplication(options: {
  database?: Pool; identityConfig?: IdentityConfig; environment?: NodeJS.ProcessEnv;
} = {}) {
  const app = express();
  const database = options.database ?? pool;
  const identityConfig = options.identityConfig ?? readIdentityConfig();
  app.use(helmet());
  if (identityConfig.enabled) {
    const service = await createSessionService(database, identityConfig, { environment: options.environment });
    const protection = createCsrfProtection(service, identityConfig);
    const invitations = createAccountInvitationService(database, identityConfig, service);
    const auth = express.Router();
    // Origin denials run before CORS, parsing or any database/password work.
    auth.use(protection.originGuard);
    const identityCors = cors({ origin: (origin, callback) => callback(null, !!origin && identityConfig.webOrigins.includes(origin)),
      credentials: true, methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'X-CSRF-Token'], maxAge: 600 });
    auth.use(identityCors);
    auth.get('/csrf', protection.bootstrap);
    auth.use(createAuthRouter(service, identityConfig, (req, res, next) => {
      const guard = ['/login', '/register', '/confirmation', '/confirmation/resend', '/recovery', '/recovery/reset', '/setup'].includes(req.path)
        ? protection.anonymousMutation : protection.sessionMutation;
      return guard(req, res, next);
    }, { onLogin: protection.clearAnonymousCookie, registration: createRegistrationService(database, identityConfig),
      recovery: createRecoveryService(database, identityConfig, { environment: options.environment }), invitations }));
    // Never fall through to the broader public Foundation parser/CORS/error logger.
    auth.use((_req, res) => { res.status(404).json({ code: 'NOT_FOUND' }); });
    app.use('/api/v1/auth', auth);
    const accounts = express.Router();
    accounts.use(protection.originGuard, identityCors);
    accounts.use(createAccountRouter(invitations, protection.sessionMutation, createAccountService(database, service), createRoleService(database, service, {environment:options.environment})));
    accounts.use((_req, res) => { res.status(404).json({ code: 'NOT_FOUND' }); });
    app.use('/api/v1/accounts', accounts);
    const management = express.Router();
    management.use(protection.originGuard, identityCors);
    management.use(createManagementRouter(service));
    management.use((_req, res) => { res.status(404).json({ code: 'NOT_FOUND' }); });
    app.use('/api/v1/management', management);
  }
  const origins = (process.env.WEB_ORIGINS ?? process.env.WEB_ORIGIN ?? 'http://localhost:5173,http://localhost:5174').split(',').map(value => value.trim());
  app.use(cors({ origin: origins }));
  app.use(express.json({ limit: '100kb' }));
  app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/v1/settings/public', async (_req, res) => {
    try { res.json(await readPublicSettings(database)); }
    catch { res.status(503).json({ code: 'UNAVAILABLE' }); }
  });
  app.get('/api/v1/ready', async (_req, res) => {
    try {
      const settings = await database.query('SELECT id FROM business_settings WHERE id=1');
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
  return app;
}

export const app = await createApplication();
