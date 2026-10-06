import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiClient} from '../src/index.ts';
const id='11111111-1111-4111-a111-111111111111';
const profile={id,personId:id,email:'demo@example.test',fullName:'Demo',phone:null,photoId:id,preferredLocale:'es-MX',roles:['customer'],status:'active',profileStatus:'active',confirmationStatus:'verified'};
test('photo mutations use fresh session CSRF, sanitize profiles and read credentialed binary responses',async()=>{
  const calls=[];const api=createApiClient('',async(url,options)=>{calls.push({url,options});
    return url==='/auth/session'?Response.json({account:profile,csrfToken:'session'}):options.method==='POST'?Response.json({...profile,path:'private path'}):new Response(new Uint8Array([1,2]),{headers:{'Content-Type':'image/webp'}});
  });
  assert.deepEqual(await api.uploadOwnPhoto({data:'YWJj'}),profile);assert.deepEqual(await api.uploadAccountPhoto(id,{data:'YWJj'}),profile);
  assert.equal((await api.getOwnPhoto()).size,2);assert.equal((await api.getAccountPhoto(id)).type,'image/webp');
  assert.deepEqual(calls.map(call=>call.url),['/auth/session','/me/photo','/auth/session',`/accounts/${id}/photo`,'/me/photo',`/accounts/${id}/photo`]);
  for(const index of [1,3]){assert.equal(calls[index].options.headers['X-CSRF-Token'],'session');assert.deepEqual(JSON.parse(calls[index].options.body),{data:'YWJj'});}
  for(const call of calls){assert.equal(call.options.credentials,'include');assert.equal(call.options.redirect,'error');}
});
test('photo client rejects unsafe targets/content and maps access failures without exposing bodies',async()=>{
  const api=createApiClient('',async()=>new Response('private path',{status:403}));
  assert.throws(()=>api.getAccountPhoto('../private'),{code:'INVALID_REQUEST'});await assert.rejects(api.getOwnPhoto(),{code:'FORBIDDEN'});
  await assert.rejects(createApiClient('',async()=>new Response('<svg/>',{headers:{'Content-Type':'image/svg+xml'}})).getOwnPhoto(),{code:'INTERNAL_ERROR'});
  await assert.rejects(createApiClient('',async()=>new Response(Buffer.alloc(1024*1024+1),{headers:{'Content-Type':'image/webp'}})).getOwnPhoto(),{code:'INTERNAL_ERROR'});
});
