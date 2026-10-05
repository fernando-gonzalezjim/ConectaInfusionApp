import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiClient} from '../src/index.ts';
const id='11111111-1111-4111-a111-111111111111';
const event={id,occurredAt:'2026-10-04T12:00:00.000001Z',actorType:'staff',actorId:id,actorName:'Manager',action:'account.profile_updated',targetType:'account',targetId:id,targetName:'Customer',businessUnit:null,correctionOf:null,changes:{before:null,after:{fullName:'Customer',password:'never expose'}}};
test('audit client bounds and sanitizes read-only credentialed history with cancellation',async()=>{
  let options,url;const controller=new AbortController();const api=createApiClient('',async(path,input)=>{url=path;options=input;return Response.json({events:[{...event,reason:'never expose'}],nextCursor:'safe_cursor'});});
  const page=await api.listOperationalAudit({limit:2,cursor:'previous'},controller.signal);
  assert.equal(url,'/audit?limit=2&cursor=previous');assert.equal(options.credentials,'include');assert.equal(options.signal,controller.signal);assert.equal(options.method,undefined);
  assert.deepEqual(page.events[0].changes.after,{fullName:'Customer'});assert.equal('reason' in page.events[0],false);
});
test('audit client preserves access denials and rejects malformed rows/cursors without retries',async()=>{
  let calls=0;await assert.rejects(createApiClient('',async()=>{calls++;return Response.json({code:'FORBIDDEN',private:'secret'},{status:403});}).listOperationalAudit(),{code:'FORBIDDEN'});assert.equal(calls,1);
  for(const page of [{events:[{...event,actorType:'owner'}],nextCursor:null},{events:[event],nextCursor:'../path'},{events:[{...event,action:'raw secret'}],nextCursor:null}])
    await assert.rejects(createApiClient('',async()=>Response.json(page)).listOperationalAudit(),{code:'INTERNAL_ERROR'});
});

test('audit client accepts family invitation history while stripping action secrets',async()=>{
  const invitation={...event,action:'family.invitation_sent',targetType:'family',targetName:'Family',
    changes:{before:null,after:{invitationId:id,invitationVersion:2,token:'never expose',recipientEmail:'private@example.test'}}};
  const page=await createApiClient('',async()=>Response.json({events:[invitation],nextCursor:null})).listOperationalAudit();
  assert.equal(page.events[0].action,'family.invitation_sent');
  assert.deepEqual(page.events[0].changes.after,{invitationId:id,invitationVersion:2});
});
test('audit client accepts all successor decisions without exposing email or action tokens',async()=>{
  for(const action of ['family.responsibility_offered','family.responsibility_accepted','family.responsibility_declined']){
    const successor={...event,action,targetType:'family',targetName:'Family',changes:{before:null,after:{invitationId:id,responsibleMembershipId:id,token:'secret',recipientEmail:'private@example.test'}}};
    const page=await createApiClient('',async()=>Response.json({events:[successor],nextCursor:null})).listOperationalAudit();
    assert.equal(page.events[0].action,action);assert.deepEqual(page.events[0].changes.after,{invitationId:id,responsibleMembershipId:id});
  }
});
