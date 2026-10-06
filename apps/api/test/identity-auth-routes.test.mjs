import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const load = () => import('../dist/modules/identity/auth-routes.js');
test('session-cookie parsing rejects ambiguity, malformed escapes and oversized headers', async () => {
  const { readSessionCookie } = await load();
  const token = randomBytes(32).toString('base64url');
  assert.equal(readSessionCookie(`theme=light; conecta_session=${token}`), token);
  for (const header of [undefined, '', `conecta_session=${token}; conecta_session=${token}`, 'conecta_session=%broken',
    `conecta_session=${token};padding=${'x'.repeat(8192)}`]) {
    assert.equal(readSessionCookie(header), undefined);
  }
});
test('auth router requires an enabled config and an explicit mutation guard before it can be mounted', async () => {
  const { createAuthRouter } = await load();
  assert.throws(() => createAuthRouter({}, { enabled: false }, () => {}), /IDENTITY_DISABLED/);
  assert.throws(() => createAuthRouter({}, { enabled: true, publicOrigin: 'http://localhost:5173' }), /AUTH_MUTATION_GUARD_REQUIRED/);
});
