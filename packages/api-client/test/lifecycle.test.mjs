import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiClient} from '../src/index.ts';
const id='11111111-1111-4111-a111-111111111111';
const state={accountId:id,status:'inactive',sessionVersion:3,dependents:[]};
test('lifecycle reads are bounded safe and writes use fresh session CSRF without automatic retries',async()=>{
 let writes=0;
 const api=createApiClient('',async(path,options)=>{
  if(path==='/auth/session')return Response.json({csrfToken:'fresh-csrf'});
  if(path.endsWith('/lifecycle'))return Response.json({...state,password_hash:'secret'});
  assert.equal(options.headers['X-CSRF-Token'],'fresh-csrf');writes++;
  return Response.json({accountId:id,status:'active',sessionVersion:4});
 });
 assert.deepEqual(await api.getAccountLifecycle(id),state);
 assert.deepEqual(await api.reactivateAccount(id,{confirmation:true,expectedSessionVersion:3}),{accountId:id,status:'active',sessionVersion:4});
 assert.equal(writes,1);
});
test('lifecycle rejects malformed previews and preserves invalid renewal links',async()=>{
 await assert.rejects(createApiClient('',async path=>Response.json(path==='/auth/session'?{csrfToken:'csrf'}:{status:'ready',revision:'bad'})).previewAccountDeactivation(id,{confirmation:true}),{code:'INTERNAL_ERROR'});
 await assert.rejects(createApiClient('',async path=>path==='/auth/session'?Response.json({csrfToken:'csrf'}):Response.json({code:'INVALID_ACTION'},{status:400})).previewGuardianReactivation({token:'a'.repeat(43)}),{code:'INVALID_ACTION'});
});
