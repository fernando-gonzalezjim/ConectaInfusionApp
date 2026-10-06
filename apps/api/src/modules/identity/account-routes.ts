import express, { type RequestHandler } from 'express';
import type { createAccountInvitationService } from './account-invitations.js';
import { failure, readSessionCookie } from './auth-routes.js';
import type { createAccountService } from './accounts.js';
import type { createRoleService } from './roles.js';

export function createAccountRouter(service: ReturnType<typeof createAccountInvitationService>, mutationGuard: RequestHandler,
  administration?: ReturnType<typeof createAccountService>, roles?: ReturnType<typeof createRoleService>) {
  if (typeof mutationGuard !== 'function') throw new Error('ACCOUNT_MUTATION_GUARD_REQUIRED');
  const router = express.Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(express.json({ limit: '2kb' }));
  if (roles) router.post('/:id/roles', mutationGuard, async (req, res) => {
    try { res.json(await roles.change(req.params.id, req.body, readSessionCookie(req.headers.cookie))); }
    catch (error) { failure(res, error); }
  });
  if (administration) {
    router.get('/', async (req, res) => {
      try { res.json(await administration.list(req.query, readSessionCookie(req.headers.cookie))); }
      catch (error) { failure(res, error); }
    });
    router.post('/:id/profile', mutationGuard, async (req, res) => {
      try { res.json(await administration.update(req.params.id, req.body, readSessionCookie(req.headers.cookie))); }
      catch (error) { failure(res, error); }
    });
  }
  for (const [path, operation] of [['/invitations', service.invite], ['/invitations/resend', service.resend]] as const) {
    router.post(path, mutationGuard, async (req, res) => {
      try { res.status(202).json(await operation(req.body, readSessionCookie(req.headers.cookie), req.socket.remoteAddress ?? '')); }
      catch (error) { failure(res, error); }
    });
  }
  router.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
    if (status === 400 || status === 413) { res.status(status).json({ code: 'INVALID_REQUEST' }); return; }
    failure(res, error);
  });
  return router;
}
