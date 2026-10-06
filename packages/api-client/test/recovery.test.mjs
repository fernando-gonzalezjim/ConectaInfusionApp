import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../src/index.ts';

test('recovery bootstraps CSRF, validates replies, hides raw failures and never retries resets', async () => {
  const calls=[];
  const api=createApiClient('',async (url,options)=>{calls.push({url,options});return Response.json(url.endsWith('/csrf')?{csrfToken:'fixture'}:{code:url.endsWith('/reset')?'PASSWORD_RESET':'ACCEPTED'});});
  await api.requestRecovery({email:'fixture@example.test'});await api.resetPassword({token:'x'.repeat(43),password:'A new password with spaces'});
  assert.deepEqual(calls.map(c=>c.url),['/auth/csrf','/auth/recovery','/auth/csrf','/auth/recovery/reset']);
  assert.equal(calls[3].options.credentials,'include');assert.equal(calls[3].options.headers['X-CSRF-Token'],'fixture');
  const invalid=createApiClient('',async url=>Response.json(url.endsWith('/csrf')?{csrfToken:'fixture'}:{code:'INVALID_ACTION',secret:'private'}, {status:url.endsWith('/csrf')?200:400}));
  await assert.rejects(invalid.resetPassword({}),{code:'INVALID_ACTION'});
  const malformed=createApiClient('',async url=>Response.json(url.endsWith('/csrf')?{csrfToken:'fixture'}:{code:'unexpected'}));
  await assert.rejects(malformed.resetPassword({}),{code:'INTERNAL_ERROR'});
});
