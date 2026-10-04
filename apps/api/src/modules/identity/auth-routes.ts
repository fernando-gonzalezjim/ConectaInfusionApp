import express, { type RequestHandler, type Response } from 'express';
import type { IdentityConfig } from './config.js';
import { AuthError, type SessionService } from './sessions.js';
import { LoginThrottleError } from './login-throttle.js';
import type { LoginResponse, SessionResponse } from '@conecta/contracts';
import { ActionError } from './action-tokens.js';
import { RegistrationError, type createRegistrationService } from './registration.js';
import type { createRecoveryService } from './recovery.js';

export const sessionCookieName = 'conecta_session';
export function readSessionCookie(header: unknown): string | undefined {
  if (typeof header !== 'string' || header.length > 4096) return undefined;
  const values = header.split(';').map(part => part.trim()).filter(part => part.startsWith(`${sessionCookieName}=`));
  if (values.length !== 1) return undefined;
  try { return decodeURIComponent(values[0]!.slice(sessionCookieName.length + 1)) || undefined; }
  catch { return undefined; }
}
function failure(res: Response, error: unknown): void {
  if (error instanceof RegistrationError || error instanceof ActionError) {
    if (error.code === 'THROTTLED') res.set('Retry-After', String(error.retryAfterSeconds ?? 60));
    res.status(error.code === 'THROTTLED' ? 429 : 400).json({ code: error.code }); return;
  }
  if (error instanceof LoginThrottleError) {
    res.set('Retry-After', String(error.retryAfterSeconds)).status(429).json({ code: error.code }); return;
  }
  if (error instanceof AuthError) {
    const status = error.code === 'INVALID_REQUEST' ? 400 : error.code === 'FORBIDDEN' ? 403
      : error.code === 'IDENTITY_DISABLED' ? 503 : 401;
    res.status(status).json({ code: error.code }); return;
  }
  // Native/database failures and overload never disclose credentials, SQL, connection strings or raw bodies.
  res.status(503).json({ code: 'UNAVAILABLE' });
}
function requireEmptyBody(value: unknown): void {
  if (value === undefined) return;
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 0) throw new AuthError('INVALID_REQUEST');
}

// Intentionally unmounted until I07 supplies exact Origin/CSRF/transport integration.
// Mutation guard is required even in a custom mount; test guards are not production middleware.
export function createAuthRouter(service: SessionService, config: IdentityConfig, mutationGuard: RequestHandler, options: {
  onLogin?: (res: Response) => void;
  registration?: ReturnType<typeof createRegistrationService>;
  recovery?: ReturnType<typeof createRecoveryService>;
} = {}): express.Router {
  if (!config.enabled) throw new AuthError('IDENTITY_DISABLED');
  if (typeof mutationGuard !== 'function') throw new Error('AUTH_MUTATION_GUARD_REQUIRED');
  const router = express.Router();
  const cookieOptions = { httpOnly: true, secure: new URL(config.publicOrigin).protocol === 'https:', sameSite: 'lax' as const, path: '/' };
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(express.json({ limit: '2kb' }));
  if (options.recovery) {
    const recovery = options.recovery;
    for (const [path, operation] of [['/recovery', recovery.request], ['/recovery/reset', recovery.reset]] as const) {
      router.post(path, mutationGuard, async (req, res) => {
        try { res.status(path === '/recovery/reset' ? 200 : 202).json(await operation(req.body, req.socket.remoteAddress ?? '')); }
        catch (error) { failure(res, error); }
      });
    }
  }
  if (options.registration) {
    const registration = options.registration;
    for (const [path, operation] of [['/register', registration.register], ['/confirmation/resend', registration.resend],
      ['/confirmation', registration.confirm]] as const) {
      router.post(path, mutationGuard, async (req, res) => {
        try { res.status(path === '/confirmation' ? 200 : 202).json(await operation(req.body, req.socket.remoteAddress ?? '')); }
        catch (error) { failure(res, error); }
      });
    }
  }
  router.post('/login', mutationGuard, async (req, res) => {
    try {
      // Forwarded headers/body IPs are not trusted. I07/launch must explicitly configure known proxies.
      const result = await service.login(req.body, req.socket.remoteAddress ?? '');
      const maxAge = (req.body.rememberMe === true ? 30 : 7) * 86400000;
      options.onLogin?.(res);
      res.cookie(sessionCookieName, result.sessionToken, { ...cookieOptions, maxAge });
      const body: LoginResponse = { account: result.account, csrfToken: result.csrfToken, expiresAt: result.expiresAt };
      res.json(body);
    } catch (error) { failure(res, error); }
  });
  router.get('/session', async (req, res) => {
    try {
      const context = await service.resolve(readSessionCookie(req.headers.cookie));
      const body: SessionResponse = { account: context.account, csrfToken: context.csrfToken, expiresAt: context.expiresAt, authenticatedAt: context.authenticatedAt };
      res.json(body);
    } catch (error) { failure(res, error); }
  });
  router.post('/logout', mutationGuard, async (req, res) => {
    try {
      requireEmptyBody(req.body);
      await service.logout(readSessionCookie(req.headers.cookie));
      res.clearCookie(sessionCookieName, cookieOptions).sendStatus(204);
    } catch (error) { failure(res, error); }
  });
  router.post('/logout-all', mutationGuard, async (req, res) => {
    try {
      requireEmptyBody(req.body);
      await service.logoutAll(readSessionCookie(req.headers.cookie));
      res.clearCookie(sessionCookieName, cookieOptions).sendStatus(204);
    } catch (error) { failure(res, error); }
  });
  router.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
    if (status === 400 || status === 413) { res.status(status).json({ code: 'INVALID_REQUEST' }); return; }
    failure(res, error);
  });
  return router;
}
