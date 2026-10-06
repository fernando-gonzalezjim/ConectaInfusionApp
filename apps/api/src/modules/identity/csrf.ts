import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { RequestHandler, Response } from 'express';
import type { EnabledIdentityConfig } from './config.js';
import { AuthError, type SessionService } from './sessions.js';
import { readSessionCookie } from './auth-routes.js';

export const anonymousCsrfCookieName = 'conecta_csrf';
const lifetime = 15 * 60000;
function equal(left: unknown, right: string): boolean {
  return typeof left === 'string' && left.length <= 150 && Buffer.byteLength(left) === Buffer.byteLength(right)
    && timingSafeEqual(Buffer.from(left), Buffer.from(right));
}
function anonymousCookie(header: unknown): string | undefined {
  if (typeof header !== 'string' || header.length > 4096) return undefined;
  const cookies = header.split(';').map(part => part.trim()).filter(part => part.startsWith(`${anonymousCsrfCookieName}=`));
  if (cookies.length !== 1) return undefined;
  try { return decodeURIComponent(cookies[0]!.slice(anonymousCsrfCookieName.length + 1)); }
  catch { return undefined; }
}

export function createCsrfProtection(service: Pick<SessionService, 'resolve'>, config: EnabledIdentityConfig, options: {
  now?: () => Date;
} = {}) {
  const allowed = new Set(config.webOrigins);
  const cookieOptions = { httpOnly: true, secure: new URL(config.publicOrigin).protocol === 'https:', sameSite: 'lax' as const, path: '/' };
  const clock = () => (options.now?.() ?? new Date()).getTime();
  function sign(value: string): string {
    const key = config.secrets.throttleKey();
    try { return createHmac('sha256', key).update('identity-anonymous-csrf-v1\0').update(value).digest('base64url'); }
    finally { key.fill(0); }
  }
  function valid(token: unknown): token is string {
    if (typeof token !== 'string' || !/^[0-9]{13}\.[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/.test(token)) return false;
    const [expires, nonce, signature] = token.split('.');
    return Number(expires) > clock() && equal(signature, sign(`${expires}.${nonce}`));
  }
  const forbid = (res: Response) => { res.status(403).json({ code: 'FORBIDDEN' }); };
  const originGuard: RequestHandler = (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const origin = req.headers.origin;
    // Same-origin GET fetches may omit Origin. All mutations must supply an exact configured origin.
    if ((origin !== undefined && (typeof origin !== 'string' || !allowed.has(origin)))
      || (!['GET', 'HEAD'].includes(req.method) && origin === undefined)) { forbid(res); return; }
    next();
  };
  const bootstrap: RequestHandler = (req, res) => {
    const existing = anonymousCookie(req.headers.cookie);
    if (valid(existing)) { res.json({ csrfToken: existing }); return; }
    const value = `${clock() + lifetime}.${randomBytes(32).toString('base64url')}`;
    const csrfToken = `${value}.${sign(value)}`;
    res.cookie(anonymousCsrfCookieName, csrfToken, { ...cookieOptions, maxAge: lifetime });
    res.json({ csrfToken });
  };
  function mutationShape(req: Parameters<RequestHandler>[0]): boolean {
    return typeof req.headers.origin === 'string' && allowed.has(req.headers.origin)
      && /^application\/json(?:\s*;|$)/i.test(req.get('Content-Type') ?? '');
  }
  const anonymousMutation: RequestHandler = (req, res, next) => {
    const cookie = anonymousCookie(req.headers.cookie);
    if (!mutationShape(req) || !valid(cookie) || !equal(req.get('X-CSRF-Token'), cookie)) { forbid(res); return; }
    next();
  };
  const sessionMutation: RequestHandler = async (req, res, next) => {
    if (!mutationShape(req)) { forbid(res); return; }
    try {
      const session = await service.resolve(readSessionCookie(req.headers.cookie));
      if (!equal(req.get('X-CSRF-Token'), session.csrfToken)) { forbid(res); return; }
      next();
    } catch (error) {
      res.status(error instanceof AuthError ? 401 : 503).json({ code: error instanceof AuthError ? 'UNAUTHENTICATED' : 'UNAVAILABLE' });
    }
  };
  return { originGuard, bootstrap, anonymousMutation, sessionMutation,
    clearAnonymousCookie: (res: Response) => res.clearCookie(anonymousCsrfCookieName, cookieOptions) };
}
