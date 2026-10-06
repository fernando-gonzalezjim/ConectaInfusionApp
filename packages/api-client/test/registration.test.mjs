import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../src/index.ts';

test('registration actions bootstrap CSRF, send credentials without retries and validate safe replies', async () => {
  const calls = [];
  const api = createApiClient('/api/v1', async (url, options) => {
    calls.push({ url, options });
    return Response.json(url.endsWith('/csrf') ? { csrfToken: 'anonymous-csrf' } : { code: url.endsWith('/confirmation') ? 'CONFIRMED' : 'ACCEPTED' });
  });
  await api.register({ fullName: 'Fixture', email: 'fixture@example.test', password: 'long fixture password', preferredLocale: 'en' });
  await api.resendConfirmation({ email: 'fixture@example.test' }); await api.confirmEmail({ token: 'x'.repeat(43) });
  assert.deepEqual(calls.map(c => c.url), ['/api/v1/auth/csrf','/api/v1/auth/register','/api/v1/auth/csrf','/api/v1/auth/confirmation/resend','/api/v1/auth/csrf','/api/v1/auth/confirmation']);
  for (const { options } of calls) assert.equal(options.credentials, 'include');
  assert.equal(calls[5].options.headers['X-CSRF-Token'], 'anonymous-csrf');
  const invalid = createApiClient('', async url => Response.json(url.endsWith('/csrf') ? { csrfToken: 'valid' } : { code: 'INVALID_ACTION' }, { status: url.endsWith('/csrf') ? 200 : 400 }));
  await assert.rejects(invalid.confirmEmail({ token: 'x'.repeat(43) }), { code: 'INVALID_ACTION' });
  const malformed = createApiClient('', async url => Response.json(url.endsWith('/csrf') ? { csrfToken: 'valid' } : { code: 'unexpected' }));
  await assert.rejects(malformed.register({}), { code: 'INTERNAL_ERROR' });
});
