import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiClient} from '../src/index.ts';
const id='11111111-1111-4111-a111-111111111111';
const profile={id,personId:id,email:'demo@example.test',fullName:'Demo',phone:null,photoId:null,preferredLocale:'es-MX',roles:['customer'],status:'active',profileStatus:'active',confirmationStatus:'verified'};
test('own profile sanitizes responses; email request uses session CSRF and confirmation uses anonymous CSRF',async()=>{
  const calls=[];const api=createApiClient('',async(url,options)=>{
    calls.push({url,options});
    return Response.json(url==='/auth/session'?{account:profile,csrfToken:'session'}:url==='/auth/csrf'?{csrfToken:'anonymous'}
      :url==='/auth/email-change'?{code:'ACCEPTED'}:url==='/auth/email-change/confirmation'?{code:'EMAIL_CHANGED'}:{...profile,password_hash:'omit'});
  });
  assert.deepEqual(await api.getOwnProfile(),profile);assert.deepEqual(await api.updateOwnProfile({fullName:'Changed'}),profile);
  await api.requestEmailChange({email:'new@example.test'});await api.confirmEmailChange({token:'A'.repeat(43)});
  assert.deepEqual(calls.map(c=>c.url),['/me','/auth/session','/me','/auth/session','/auth/email-change','/auth/csrf','/auth/email-change/confirmation']);
  for(const i of [2,4])assert.equal(calls[i].options.headers['X-CSRF-Token'],'session');
  assert.equal(calls[6].options.headers['X-CSRF-Token'],'anonymous');
});
test('recent-auth and invalid email actions preserve safe codes without retrying or leaking bodies',async()=>{
  let mutations=0;const api=createApiClient('',async url=>{
    if(url==='/auth/session'||url==='/auth/csrf')return Response.json({csrfToken:'fresh'});
    mutations++;return Response.json({code:url.endsWith('/confirmation')?'INVALID_ACTION':'RECENT_AUTH_REQUIRED',private:'omit'}, {status:url.endsWith('/confirmation')?400:403});
  });
  await assert.rejects(api.requestEmailChange({email:'new@example.test'}),{code:'RECENT_AUTH_REQUIRED'});
  await assert.rejects(api.confirmEmailChange({token:'A'.repeat(43)}),{code:'INVALID_ACTION'});assert.equal(mutations,2);
});
