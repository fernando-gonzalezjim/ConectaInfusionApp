import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../src/index.ts';
test('invitation mutations use fresh session CSRF; setup uses anonymous CSRF and safe single-attempt replies',async()=>{
  const calls=[];
  const api=createApiClient('',async(url,options)=>{calls.push({url,options});return Response.json(url.endsWith('/session')||url.endsWith('/csrf')?{csrfToken:'fixture'}:{code:url.endsWith('/setup')?'PASSWORD_SET':'ACCEPTED',privateProfile:'ignored'});});
  assert.deepEqual(await api.inviteCustomer({email:'invite@example.test',fullName:'Customer'}),{code:'ACCEPTED'});
  await api.resendInvitation({email:'invite@example.test'});
  assert.deepEqual(await api.setupPassword({token:'x'.repeat(43),password:'A normal invitation password'}),{code:'PASSWORD_SET'});
  assert.deepEqual(calls.map(c=>c.url),['/auth/session','/accounts/invitations','/auth/session','/accounts/invitations/resend','/auth/csrf','/auth/setup']);
  for(const index of [1,3,5]){assert.equal(calls[index].options.credentials,'include');assert.equal(calls[index].options.headers['X-CSRF-Token'],'fixture');}
  const rejected=createApiClient('',async url=>Response.json(url.endsWith('/csrf')?{csrfToken:'fixture'}:{code:'INVALID_ACTION',raw:'private'},{status:url.endsWith('/csrf')?200:400}));
  await assert.rejects(rejected.setupPassword({}),{code:'INVALID_ACTION'});
  const malformed=createApiClient('',async url=>Response.json(url.endsWith('/session')?{csrfToken:'fixture'}:{code:'unexpected'}));
  await assert.rejects(malformed.inviteCustomer({}),{code:'INTERNAL_ERROR'});
});
