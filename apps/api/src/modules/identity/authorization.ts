import express from 'express';
import type { ManagementAccessResponse } from '@conecta/contracts';
import { AuthError, type SessionService } from './sessions.js';
import { readSessionCookie } from './auth-routes.js';

// The session resolver reads current account/person status, version and roles from PostgreSQL.
export function requireManagement(service: SessionService, token: unknown) {
  return service.resolve(token, ['administrator', 'manager']);
}
export function createManagementRouter(service: SessionService): express.Router {
  const router = express.Router();
  router.get('/access', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const session = await requireManagement(service, readSessionCookie(req.headers.cookie));
      const body: ManagementAccessResponse = { account: session.account, capabilities: { administerIdentity: true } };
      res.json(body);
    } catch (error) {
      const code = error instanceof AuthError ? error.code : 'UNAVAILABLE';
      res.status(code === 'FORBIDDEN' ? 403 : code === 'UNAUTHENTICATED' ? 401 : 503).json({ code });
    }
  });
  return router;
}
