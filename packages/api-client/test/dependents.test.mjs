import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiClient} from '../src/index.ts';
const id='11111111-1111-4111-a111-111111111111';
const child={id,childName:'Fictional child',ageText:'8',dependentPersonId:null,version:0};
const dependent={id,fullName:'Fictional child',ageText:'8',preferredLocale:'es-MX',version:0,guardians:[{accountId:id,fullName:'Guardian'}]};

test('guardian removal client uses exact relationship IDs, fresh CSRF and minimal bounded DTOs',async()=>{
  const calls=[];const api=createApiClient('',async(path,options)=>{calls.push({path,options});return Response.json(path==='/auth/session'?{csrfToken:'safe-csrf'}:path.endsWith('/remove')?{dependentId:id,guardianRelationshipId:id,token:'private'}:{items:[{id,accountId:id,fullName:'Guardian',canRemove:true,email:'private'}],nextCursor:null});});
  assert.deepEqual(await api.listGuardians(id,{limit:2}),{items:[{id,accountId:id,fullName:'Guardian',canRemove:true}],nextCursor:null});
  assert.deepEqual(await api.removeGuardian(id,id),{dependentId:id,guardianRelationshipId:id});const write=calls.at(-1);assert.equal(write.path,`/dependents/${id}/guardians/${id}/remove`);assert.equal(write.options.headers['X-CSRF-Token'],'safe-csrf');assert.deepEqual(JSON.parse(write.options.body),{});
  assert.deepEqual(await api.removeGuardian(id.toUpperCase(),id.toUpperCase()),{dependentId:id,guardianRelationshipId:id});
  await assert.rejects(api.listGuardians(id,{limit:51}),{code:'INVALID_REQUEST'});
  for(const [status,code] of [[403,'FORBIDDEN'],[404,'NOT_FOUND'],[409,'CONFLICT'],[503,'UNAVAILABLE']]){let writes=0;const bad=createApiClient('',async(path)=>path==='/auth/session'?Response.json({csrfToken:'safe'}):(writes++,Response.json({code,raw:'private'},{status})));await assert.rejects(bad.removeGuardian(id,id),{code});assert.equal(writes,1);}
});

test('guardian client minimizes preview/assistance DTOs and sends CSRF before explicit acceptance',async()=>{
  const calls=[];const api=createApiClient('',async(path,options)=>{calls.push({path,options});return Response.json(path==='/auth/session'?{csrfToken:'safe-csrf'}:path.includes('/for-account/')?{items:[{id,fullName:'Child',ageText:'private'}],nextCursor:null}:path.endsWith('/preview')?{dependent:{id,fullName:'Child',ageText:'private'},expiresAt:'2026-10-12T12:00:00.000Z',token:'private'}:path.endsWith('/accept')?{dependentId:id,roles:['manager']}:{code:'ACCEPTED',email:'private'});});
  assert.deepEqual(await api.listGuardianInviteTargets(id),{items:[{id,fullName:'Child'}],nextCursor:null});
  assert.deepEqual(await api.inviteGuardian(id,{email:'recipient@example.test'}),{code:'ACCEPTED'});
  assert.deepEqual(await api.previewGuardianInvitation({token:'opaque'}),{dependent:{id,fullName:'Child'},expiresAt:'2026-10-12T12:00:00.000Z'});
  assert.deepEqual(await api.acceptGuardianInvitation({token:'opaque'}),{dependentId:id});
  const writes=calls.filter(call=>call.options.method==='POST');assert.equal(writes.length,3);assert.ok(writes.every(call=>call.options.headers['X-CSRF-Token']==='safe-csrf'));
  const bad=createApiClient('',async(path)=>Response.json(path==='/auth/session'?{csrfToken:'safe'}:{code:'INVALID_ACTION'},{status:path==='/auth/session'?200:400}));
  await assert.rejects(bad.previewGuardianInvitation({token:'opaque'}),{code:'INVALID_ACTION'});
  await assert.rejects(bad.acceptGuardianInvitation({token:'opaque'}),{code:'INVALID_ACTION'});
  await assert.rejects(api.listGuardianInviteTargets(id,{limit:51}),{code:'INVALID_REQUEST'});
});
test('dependent client uses session CSRF, bounded reads and private DTO projections',async()=>{
  const calls=[];const controller=new AbortController();
  const api=createApiClient('',async(path,options)=>{calls.push({path,options});return Response.json(path==='/auth/session'?{csrfToken:'session-csrf'}:path.includes('/convert')?{child:{...child,dependentPersonId:id,version:1},dependent}:path.startsWith('/dependents')?{items:[{...dependent,email:'private'}],nextCursor:null}:{...child,ownerAccountId:id});});
  assert.deepEqual(await api.listDependents({limit:2},controller.signal),{items:[dependent],nextCursor:null});
  assert.equal(calls[0].path,'/dependents?limit=2');assert.equal(calls[0].options.signal,controller.signal);assert.equal(calls[0].options.credentials,'include');
  assert.deepEqual(await api.createChildDetails({childName:'Fictional child',ageText:'8'}),child);
  assert.equal(calls[2].options.headers['X-CSRF-Token'],'session-csrf');
  assert.equal(calls[2].options.method,'POST');assert.deepEqual(JSON.parse(calls[2].options.body),{childName:'Fictional child',ageText:'8'});
  assert.deepEqual(await api.convertChildDetails(id,{expectedVersion:0}),{child:{...child,dependentPersonId:id,version:1},dependent});
});
test('dependent client rejects unsafe identifiers, malformed pages and incomplete guardian profiles',async()=>{
  let calls=0;const api=createApiClient('',async()=>{calls++;return Response.json(child);});
  await assert.rejects(api.getDependent('../account'),{code:'INVALID_REQUEST'});await assert.rejects(api.listChildDetails({limit:51}),{code:'INVALID_REQUEST'});assert.equal(calls,0);
  for(const result of [{items:[{...dependent,guardians:[]}],nextCursor:null},{items:[{...dependent,version:-1}],nextCursor:null},{items:[dependent],nextCursor:'../path'}])
    await assert.rejects(createApiClient('',async()=>Response.json(result)).listDependents(),{code:'INTERNAL_ERROR'});
  await assert.rejects(createApiClient('',async()=>Response.json({...child,ageText:'\n'})).getChildDetails(id),{code:'INTERNAL_ERROR'});
});
test('dependent mutations preserve authorization/conflict errors and never retry uncertain writes',async()=>{
  for(const [status,code] of [[401,'UNAUTHENTICATED'],[403,'FORBIDDEN'],[404,'NOT_FOUND'],[409,'CONFLICT'],[503,'UNAVAILABLE']]){
    let writes=0;const api=createApiClient('',async(path)=>path==='/auth/session'?Response.json({csrfToken:'safe-csrf'}):(writes++,Response.json({raw:'private'},{status})));
    await assert.rejects(api.updateDependent(id,{fullName:'Child',ageText:'8',expectedVersion:0}),{code});assert.equal(writes,1);
  }
});
