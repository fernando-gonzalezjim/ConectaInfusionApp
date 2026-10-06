import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiClient} from '../src/index.ts';
const id='11111111-1111-4111-a111-111111111111';
const family={id,name:'Family',createdByPersonId:id,responsibleMembershipId:id,status:'active',version:1};
test('successor client preserves explicit decisions, safe DTOs, CSRF and bounded error mapping',async()=>{
  const calls=[];const api=createApiClient('',async(path,options)=>{calls.push({path,options});return Response.json(path==='/auth/session'?{csrfToken:'fresh'}:path.endsWith('/responsibility')?{canNominate:true,token:'secret'}:path.endsWith('/successor-offers')?{code:'ACCEPTED'}:path.endsWith('/preview')?{family:{id,name:'Family',email:'secret'},expiresAt:'2026-10-11T12:00:00.000Z'}:{...family,token:'secret'});});
  assert.deepEqual(await api.getFamilyResponsibility(id),{canNominate:true});
  assert.deepEqual(await api.nominateFamilySuccessor(id,{email:'member@example.test'}),{code:'ACCEPTED'});
  assert.deepEqual(await api.previewFamilySuccessor({token:'x'.repeat(43)}),{family:{id,name:'Family'},expiresAt:'2026-10-11T12:00:00.000Z'});
  assert.deepEqual(await api.acceptFamilySuccessor({token:'x'.repeat(43)}),family);assert.deepEqual(await api.declineFamilySuccessor({token:'x'.repeat(43)}),family);
  for(const {path,options} of calls){assert.equal(options.credentials,'include');assert.equal(options.redirect,'error');assert.ok(!path.includes('xxx'));if(options.method==='POST')assert.equal(options.headers['X-CSRF-Token'],'fresh');}
  for(const operation of ['previewFamilySuccessor','acceptFamilySuccessor','declineFamilySuccessor']){
    let attempts=0;const invalid=createApiClient('',async path=>path==='/auth/session'?Response.json({csrfToken:'fresh'}):(attempts++,Response.json({code:'INVALID_ACTION',raw:'secret'},{status:400})));
    await assert.rejects(invalid[operation]({token:'x'.repeat(43)}),{code:'INVALID_ACTION'});assert.equal(attempts,1);
  }
  const malformed=createApiClient('',async()=>Response.json({canNominate:'true'}));await assert.rejects(malformed.getFamilyResponsibility(id),{code:'INTERNAL_ERROR'});
});
test('family client uses fresh session CSRF, private bounded DTOs and cancellation',async()=>{
  const requests=[];const controller=new AbortController();
  const api=createApiClient('',async(path,options)=>{requests.push({path,options});return Response.json(path==='/auth/session'?{csrfToken:'session-csrf'}:path.endsWith('/preview')?{family:{id,name:'Family',token:'secret'},expiresAt:'2026-10-11T12:00:00.000Z'}:path.endsWith('/invitations')?{code:'ACCEPTED',token:'secret'}:path.endsWith('/current')||path.includes('/for-account/')?{family:{...family,password:'secret'}}:{...family,token:'secret'});});
  assert.deepEqual(await api.getCurrentFamily(controller.signal),{family});assert.deepEqual(await api.getAccountFamily(id),{family});
  assert.deepEqual(await api.createFamily({name:'Family'},controller.signal),family);
  assert.deepEqual(await api.inviteFamilyMember(id,{email:'invitee@example.test'}),{code:'ACCEPTED'});
  assert.deepEqual(await api.previewFamilyInvitation({token:'x'.repeat(43)}),{family:{id,name:'Family'},expiresAt:'2026-10-11T12:00:00.000Z'});
  assert.deepEqual(await api.acceptFamilyInvitation({token:'x'.repeat(43)}),family);
  for(const {options} of requests){assert.equal(options.credentials,'include');assert.equal(options.redirect,'error');}
  const write=requests.find(r=>r.path==='/families');assert.equal(write.options.signal,controller.signal);assert.equal(write.options.headers['X-CSRF-Token'],'session-csrf');
  assert.deepEqual(JSON.parse(write.options.body),{name:'Family'});
});
test('family client preserves consent/access errors, rejects malformed summaries and never retries acceptance',async()=>{
  for(const [status,code] of [[400,'INVALID_ACTION'],[401,'UNAUTHENTICATED'],[403,'FORBIDDEN'],[409,'CONFLICT'],[503,'UNAVAILABLE']]){
    let calls=0;const api=createApiClient('',async path=>path==='/auth/session'?Response.json({csrfToken:'session-csrf'}):(calls++,Response.json({code,raw:'secret'},{status})));
    await assert.rejects(api.acceptFamilyInvitation({token:'x'.repeat(43)}),{code});assert.equal(calls,1);
    await assert.rejects(api.previewFamilyInvitation({token:'x'.repeat(43)}),{code});assert.equal(calls,2);
  }
  for(const response of [{family:{...family,id:'bad'}},{family:{...family,version:-1}},{family:{...family,name:'x'.repeat(121)}},{family:{...family,status:'pending'}},{}])
    await assert.rejects(createApiClient('',async()=>Response.json(response)).getCurrentFamily(),{code:'INTERNAL_ERROR'});
  let calls=0;const api=createApiClient('',async()=>{calls++;return Response.json({});});assert.throws(()=>api.getAccountFamily('../path'),{code:'INVALID_REQUEST'});assert.equal(calls,0);
});
