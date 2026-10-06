import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../src/index.ts';
const id='11111111-1111-4111-a111-111111111111';
const profile={id,personId:id,email:'demo@example.test',fullName:'Demo',phone:null,photoId:null,preferredLocale:'es-MX',roles:['customer'],status:'active',profileStatus:'active',confirmationStatus:'exempt'};
test('account methods bound queries, sanitize DTOs and fetch fresh CSRF for every mutation',async()=>{
  const calls=[];
  const api=createApiClient('',async(url,options)=>{calls.push({url,options});return Response.json(url==='/auth/session'?{csrfToken:'fresh'}:url.includes('/roles')?{accountId:id,roles:['customer','manager'],staffAttendanceEligible:true,secret:'omit'}:url.includes('/profile')?{...profile,password_hash:'omit'}:{accounts:[{...profile,password_hash:'omit'}],nextCursor:null});});
  assert.deepEqual(await api.listAccounts({role:'customer',status:'active',limit:25}),{accounts:[profile],nextCursor:null});
  assert.deepEqual(await api.updateAccountProfile(id,{fullName:'Updated'}),profile);
  assert.deepEqual(await api.changeAccountRoles(id,{roles:['customer','manager']}),{accountId:id,roles:['customer','manager'],staffAttendanceEligible:true});
  assert.equal(calls[0].url,'/accounts?limit=25&role=customer&status=active');
  assert.deepEqual(calls.slice(1).map(c=>c.url),['/auth/session',`/accounts/${id}/profile`,'/auth/session',`/accounts/${id}/roles`]);
  assert.equal(calls[2].options.headers['X-CSRF-Token'],'fresh');
  assert.equal(calls[4].options.headers['X-CSRF-Token'],'fresh');
  await assert.rejects(api.changeAccountRoles('../unsafe',{}),{code:'INVALID_REQUEST'});
});
test('malformed account responses and privilege conflicts never expose raw server fields or retry mutations',async()=>{
  const malformed=createApiClient('',async()=>Response.json({accounts:[{...profile,roles:['owner']}],nextCursor:null}));
  await assert.rejects(malformed.listAccounts(),{code:'INTERNAL_ERROR'});
  let mutations=0;
  const conflict=createApiClient('',async url=>{if(url==='/auth/session')return Response.json({csrfToken:'fresh'});mutations++;return Response.json({code:'CONFLICT',private:'hidden'},{status:409});});
  await assert.rejects(conflict.changeAccountRoles(id,{roles:['customer']}),{code:'CONFLICT'});
  assert.equal(mutations,1);
});
