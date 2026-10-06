import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {isolatedDatabase,migrate} from './identity-helpers.mjs';
import {authConfig,createAuthAccount,password} from './identity-auth-helpers.mjs';
import {createSessionService} from '../../dist/modules/identity/sessions.js';
import {createDeactivationService} from '../../dist/modules/identity/deactivation.js';
import {createIdentityLifecycleComposition} from '../../dist/composition/identity-lifecycle.js';
import {createGuardianInvitationService} from '../../dist/modules/identity/guardian-invitations.js';
import {decryptOutboxPayload} from '../../dist/modules/identity/outbox-crypto.js';
import {createChildDetailsService} from '../../dist/modules/identity/child-details.js';
import {createAccountService} from '../../dist/modules/identity/accounts.js';
import {createAuditViewService} from '../../dist/modules/identity/audit-view.js';

function coordinators(apply=async()=>{}){return ['credits-bookings','studio-catalog','instructor-payroll'].map(domain=>({domain,tables:[],handlesLegacy:true,inspect:async()=>({status:'ready',revision:'test-only',assurances:{atomic:true,audit:true,preservesHistory:true}}),apply:async(c,r)=>{await apply(c,r,domain);return {status:'applied',revision:'test-only'};}}));}
async function fixture(){const db=await isolatedDatabase();migrate(db.name);const config=authConfig(),sessions=await createSessionService(db.pool,config),manager=await createAuthAccount(db.pool,'manager@example.test',['manager']),target=await createAuthAccount(db.pool,'target@example.test');const login=await sessions.login({email:manager.email,password},'127.0.0.1');return {...db,config,sessions,manager,target,token:login.sessionToken};}
const input={confirmation:true,creditChoice:'keep',dependentPersonIds:[]};
async function child(f){const id=randomUUID(),c=await f.pool.connect();try{await c.query('BEGIN');await c.query("INSERT INTO people(id,full_name) VALUES ($1,'Dependent fixture')",[id]);await c.query("INSERT INTO dependent_profiles(person_id,age_text,created_by_account_id) VALUES ($1,'8',$2)",[id,f.target.accountId]);await c.query("INSERT INTO dependent_guardians(dependent_person_id,guardian_account_id,source,accepted_by_account_id) VALUES ($1,$2,'creation',$2)",[id,f.target.accountId]);await c.query('COMMIT');return id;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}

test('deactivation defaults block absent owning integrations and ordinary personnel cannot deactivate customers',async()=>{const f=await fixture();try{const service=createDeactivationService(f.pool,f.sessions);assert.equal((await service.preview(f.target.accountId,input,f.token)).status,'blocked');await assert.rejects(service.execute(f.target.accountId,{...input,idempotencyKey:randomUUID(),expectedRevision:'a'.repeat(64)},f.token),{message:'CONFLICT'});for(const role of ['reception','cafe_staff','instructor']){const a=await createAuthAccount(f.pool,role+'@example.test',[role]),l=await f.sessions.login({email:a.email,password},'127.0.0.3');await assert.rejects(service.preview(f.target.accountId,input,l.sessionToken),{message:'FORBIDDEN'});}assert.equal((await f.pool.query('SELECT status FROM accounts WHERE id=$1',[f.target.accountId])).rows[0].status,'active');}finally{await f.pool.end();}});

test('authorized deactivation revokes sessions, preserves rows, records audit and replays only for freshly authorized management',async()=>{const f=await fixture();try{const targetLogin=await f.sessions.login({email:f.target.email,password},'127.0.0.2'),service=createDeactivationService(f.pool,f.sessions,{composition:createIdentityLifecycleComposition(coordinators())});const preview=await service.preview(f.target.accountId,input,f.token);assert.equal(preview.status,'ready');const execution={...input,idempotencyKey:randomUUID(),expectedRevision:preview.revision};const receipt=await service.execute(f.target.accountId,execution,f.token);assert.deepEqual(await service.execute(f.target.accountId,execution,f.token),receipt);await assert.rejects(f.sessions.resolve(targetLogin.sessionToken),{message:'UNAUTHENTICATED'});assert.equal((await f.pool.query('SELECT status FROM people WHERE id=$1',[f.target.personId])).rows[0].status,'inactive');assert.equal((await f.pool.query("SELECT count(*)::int n FROM audit_events WHERE action='account.deactivated'")).rows[0].n,1);await f.pool.query('UPDATE accounts SET session_version=session_version+1 WHERE id=$1',[f.manager.accountId]);await assert.rejects(service.execute(f.target.accountId,execution,f.token),{message:'UNAUTHENTICATED'});}finally{await f.pool.end();}});

test('sole guardian requires explicit joint dependent deactivation and snapshots prior guardians before ending access',async()=>{const f=await fixture();try{const id=await child(f),service=createDeactivationService(f.pool,f.sessions,{composition:createIdentityLifecycleComposition(coordinators())});await assert.rejects(service.preview(f.target.accountId,input,f.token),{message:'CONFLICT'});const choice={...input,dependentPersonIds:[id]},preview=await service.preview(f.target.accountId,choice,f.token);await service.execute(f.target.accountId,{...choice,idempotencyKey:randomUUID(),expectedRevision:preview.revision},f.token);assert.equal((await f.pool.query('SELECT status FROM people WHERE id=$1',[id])).rows[0].status,'inactive');assert.equal((await f.pool.query('SELECT count(*)::int n FROM dependent_prior_guardians WHERE dependent_person_id=$1',[id])).rows[0].n,1);assert.equal((await f.pool.query('SELECT end_reason FROM dependent_guardians WHERE dependent_person_id=$1',[id])).rows[0].end_reason,'dependent_deactivated');}finally{await f.pool.end();}});

test('accepted guardian transfer preserves the other guardian and child bookings; pending consent cannot satisfy it',async()=>{
  const f=await fixture();try{
    const childId=await child(f),parentLogin=await f.sessions.login({email:f.target.email,password},'127.0.0.2'),other=await createAuthAccount(f.pool,'other@example.test'),otherLogin=await f.sessions.login({email:other.email,password},'127.0.0.3');
    const invitations=createGuardianInvitationService(f.pool,f.config,f.sessions),service=createDeactivationService(f.pool,f.sessions,{composition:createIdentityLifecycleComposition(coordinators())});
    await invitations.invite(childId,{email:other.email},parentLogin.sessionToken,'127.0.0.2');
    await assert.rejects(service.preview(f.target.accountId,input,f.token),{message:'CONFLICT'});
    const o=(await f.pool.query('SELECT * FROM identity_email_outbox ORDER BY created_at DESC LIMIT 1')).rows[0],raw=JSON.parse(decryptOutboxPayload({keyId:o.key_id,nonce:o.nonce,authTag:o.auth_tag,ciphertext:o.ciphertext},{outboxId:o.id,actionTokenId:o.action_token_id,kind:'action',recipientHash:o.recipient_hash},f.config.secrets)).token;
    await invitations.accept({token:raw},otherLogin.sessionToken,'127.0.0.3');
    await assert.rejects(service.preview(f.target.accountId,{...input,dependentPersonIds:[childId]},f.token),{message:'CONFLICT'});
    const member=(await f.pool.query("INSERT INTO members(full_name,email) VALUES ('Legacy child attendee','child@example.test') RETURNING id")).rows[0].id,instructor=(await f.pool.query("INSERT INTO instructors(full_name) VALUES ('Teacher') RETURNING id")).rows[0].id,session=(await f.pool.query("INSERT INTO class_sessions(title,instructor_id,starts_at,duration_minutes,capacity) VALUES ('Kids',$1,now()+interval '1 day',60,16) RETURNING id",[instructor])).rows[0].id;
    const booking=(await f.pool.query("INSERT INTO bookings(member_id,class_session_id,acting_account_id,attendee_person_id,child_name_snapshot,child_age_snapshot) VALUES ($1,$2,$3,$4,'Dependent fixture','8') RETURNING *",[member,session,f.target.accountId,childId])).rows[0];
    const preview=await service.preview(f.target.accountId,input,f.token);await service.execute(f.target.accountId,{...input,idempotencyKey:randomUUID(),expectedRevision:preview.revision},f.token);
    assert.deepEqual((await f.pool.query('SELECT * FROM bookings WHERE id=$1',[booking.id])).rows[0],booking);
    assert.equal((await createChildDetailsService(f.pool,f.sessions).getDependent(childId,otherLogin.sessionToken)).guardians.length,1);
    assert.equal((await f.pool.query('SELECT status FROM people WHERE id=$1',[childId])).rows[0].status,'active');
  }finally{await f.pool.end();}
});

test('coordinator and audit failures roll back domain, family and account effects; concurrent retries apply once',async()=>{
  const f=await fixture();try{
    const familyId=randomUUID(),membershipId=randomUUID(),c=await f.pool.connect();try{await c.query('BEGIN');await c.query("INSERT INTO families(id,name,created_by_person_id) VALUES ($1,'Family fixture',$2)",[familyId,f.target.personId]);await c.query("INSERT INTO family_memberships(id,family_id,person_id,source,accepted_by_person_id,joined_at) VALUES ($1,$2,$3,'creation',$3,clock_timestamp())",[membershipId,familyId,f.target.personId]);await c.query('UPDATE families SET responsible_membership_id=$2,version=version+1 WHERE id=$1',[familyId,membershipId]);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
    let applies=0;const service=createDeactivationService(f.pool,f.sessions,{composition:createIdentityLifecycleComposition(coordinators(async(tx,_r,domain)=>{if(domain==='credits-bookings'){applies++;await tx.query("UPDATE people SET phone='coordinated test effect' WHERE id=$1",[f.target.personId]);}}))});
    const preview=await service.preview(f.target.accountId,input,f.token),execution={...input,idempotencyKey:randomUUID(),expectedRevision:preview.revision};
    await f.pool.query("CREATE FUNCTION fail_deactivation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='account.deactivated' THEN RAISE EXCEPTION 'controlled audit failure'; END IF; RETURN NEW; END $$");await f.pool.query('CREATE TRIGGER fail_deactivation BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION fail_deactivation()');
    await assert.rejects(service.execute(f.target.accountId,execution,f.token),{message:'controlled audit failure'});
    assert.equal((await f.pool.query('SELECT phone FROM people WHERE id=$1',[f.target.personId])).rows[0].phone,null);assert.equal((await f.pool.query('SELECT ended_at FROM family_memberships WHERE id=$1',[membershipId])).rows[0].ended_at,null);assert.equal((await f.pool.query('SELECT status FROM families WHERE id=$1',[familyId])).rows[0].status,'active');assert.equal((await f.pool.query('SELECT count(*)::int n FROM identity_lifecycle_operations')).rows[0].n,0);
    await f.pool.query('DROP TRIGGER fail_deactivation ON audit_events');applies=0;const results=await Promise.all([1,2].map(()=>service.execute(f.target.accountId,execution,f.token)));assert.deepEqual(results[0],results[1]);assert.equal(applies,1);
    assert.equal((await f.pool.query('SELECT status,responsible_membership_id FROM families WHERE id=$1',[familyId])).rows[0].status,'closed');
    const page=await createAuditViewService(createAccountService(f.pool,f.sessions)).list({},f.token),event=page.events.find(e=>e.action==='identity.lifecycle_applied');assert.equal(event.targetType,'lifecycle_operation');assert.equal(event.targetId,results[0].operationId);assert.deepEqual(Object.keys(event.changes.after),['personId']);
    assert.ok(page.events.some(e=>e.action==='family.closed'));
  }finally{await f.pool.end();}
});

test('self-deactivation requires customer role, explicit disposition and recent authentication; changed intent cannot replay',async()=>{
  const f=await fixture();try{
    const login=await f.sessions.login({email:f.target.email,password},'127.0.0.2');let seen;
    const service=createDeactivationService(f.pool,f.sessions,{composition:createIdentityLifecycleComposition(coordinators(async(_c,r)=>{seen=r.deactivation;}))});
    await assert.rejects(service.preview(f.target.accountId,{confirmation:true},login.sessionToken),{message:'INVALID_REQUEST'});
    await assert.rejects(service.preview(f.target.accountId,{...input,confirmation:false},login.sessionToken),{message:'INVALID_REQUEST'});
    await f.pool.query("UPDATE identity_sessions SET created_at=created_at-interval '10 minutes',authenticated_at=authenticated_at-interval '10 minutes',expires_at=expires_at-interval '10 minutes' WHERE account_id=$1",[f.target.accountId]);await assert.rejects(service.preview(f.target.accountId,input,login.sessionToken),{message:'RECENT_AUTH_REQUIRED'});
    const fresh=await f.sessions.login({email:f.target.email,password},'127.0.0.2'),choice={...input,creditChoice:'leave-family'},preview=await service.preview(f.target.accountId,choice,fresh.sessionToken);await service.execute(f.target.accountId,{...choice,idempotencyKey:randomUUID(),expectedRevision:preview.revision},fresh.sessionToken);assert.deepEqual(seen,{accountId:f.target.accountId,creditChoice:'leave-family'});await assert.rejects(f.sessions.resolve(fresh.sessionToken),{message:'UNAUTHENTICATED'});
    await assert.rejects(service.preview(f.manager.accountId,input,f.token),{message:'FORBIDDEN'});
  }finally{await f.pool.end();}
});

test('final administrator protection serializes cross-deactivation and stale previews reject changed account state',async()=>{
  const f=await fixture();try{
    await f.pool.query("INSERT INTO account_roles(account_id,role) VALUES ($1,'manager')",[f.target.accountId]);await f.pool.query("INSERT INTO account_roles(account_id,role) VALUES ($1,'customer')",[f.manager.accountId]);
    const other=await f.sessions.login({email:f.target.email,password},'127.0.0.2'),service=createDeactivationService(f.pool,f.sessions,{composition:createIdentityLifecycleComposition(coordinators())}),p1=await service.preview(f.target.accountId,input,f.token),p2=await service.preview(f.manager.accountId,input,other.sessionToken);
    const results=await Promise.allSettled([service.execute(f.target.accountId,{...input,idempotencyKey:randomUUID(),expectedRevision:p1.revision},f.token),service.execute(f.manager.accountId,{...input,idempotencyKey:randomUUID(),expectedRevision:p2.revision},other.sessionToken)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await f.pool.query("SELECT count(*)::int n FROM accounts WHERE status='active'")).rows[0].n,1);
    const remaining=(await f.pool.query("SELECT id FROM accounts WHERE status='active'")).rows[0].id,token=remaining===f.manager.accountId?f.token:other.sessionToken;await assert.rejects(service.preview(remaining,input,token),{message:'CONFLICT'});
  }finally{await f.pool.end();}
});

test('private deactivation HTTP guards precede parsing; response is minimal and safe retry changes conflict',async()=>{
  const f=await fixture(),previous=process.env.DATABASE_URL;let server;try{
    process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/unused';const {createApplication}=await import('../../dist/app.js');
    server=(await createApplication({database:f.pool,identityConfig:f.config,environment:{NODE_ENV:'test'},identityLifecycle:createIdentityLifecycleComposition(coordinators())})).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
    const login=await f.sessions.login({email:f.manager.email,password},'127.0.0.1'),base=`http://127.0.0.1:${server.address().port}/api/v1/accounts/${f.target.accountId}`,headers={Origin:'http://localhost:5173','Content-Type':'application/json',Cookie:`conecta_session=${login.sessionToken}`,'X-CSRF-Token':login.csrfToken};
    async function post(path,body,h=headers){return fetch(base+path,{method:'POST',headers:h,body:typeof body==='string'?body:JSON.stringify(body)});}
    assert.equal((await post('/deactivation/preview','x'.repeat(9000),{...headers,'X-CSRF-Token':''})).status,403);assert.equal((await post('/deactivation/preview',input,{...headers,Origin:'https://hostile.example'})).status,403);assert.equal((await post('/deactivation/preview','x'.repeat(9000))).status,413);assert.equal((await post('/deactivation/preview',{...input,roles:['administrator']})).status,400);assert.equal((await fetch(base+'/deactivation',{headers})).status,404);
    const response=await post('/deactivation/preview',input);assert.equal(response.headers.get('cache-control'),'no-store');const preview=await response.json();assert.deepEqual(Object.keys(preview).sort(),['revision','status']);
    const execution={...input,idempotencyKey:randomUUID(),expectedRevision:preview.revision},completed=await post('/deactivation',execution);assert.equal(completed.status,200);assert.deepEqual(Object.keys(await completed.json()).sort(),['code','operationId']);assert.equal((await post('/deactivation',{...execution,expectedRevision:'b'.repeat(64)})).status,409);
  }finally{if(server)await new Promise(r=>server.close(r));if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;await f.pool.end();}
});

test('stale identity revisions, coordinator failures and post-wait authentication expiry preserve every effect',async()=>{
  const f=await fixture();try{
    const service=createDeactivationService(f.pool,f.sessions,{composition:createIdentityLifecycleComposition(coordinators())}),preview=await service.preview(f.target.accountId,input,f.token);
    await f.pool.query('UPDATE accounts SET session_version=session_version+1 WHERE id=$1',[f.target.accountId]);
    await assert.rejects(service.execute(f.target.accountId,{...input,idempotencyKey:randomUUID(),expectedRevision:preview.revision},f.token),{message:'CONFLICT'});
    const failing=createDeactivationService(f.pool,f.sessions,{composition:createIdentityLifecycleComposition(coordinators(async(tx)=>{await tx.query("UPDATE people SET phone='must roll back' WHERE id=$1",[f.target.personId]);throw new Error('controlled domain failure');}))});
    const fresh=await failing.preview(f.target.accountId,input,f.token);await assert.rejects(failing.execute(f.target.accountId,{...input,idempotencyKey:randomUUID(),expectedRevision:fresh.revision},f.token),{message:'controlled domain failure'});
    let now=new Date();const delayed=createDeactivationService(f.pool,f.sessions,{now:()=>now,composition:createIdentityLifecycleComposition(coordinators(async()=>{now=new Date(Date.now()+8*86400000);} ))});
    const next=await delayed.preview(f.target.accountId,input,f.token);await assert.rejects(delayed.execute(f.target.accountId,{...input,idempotencyKey:randomUUID(),expectedRevision:next.revision},f.token),{message:'UNAUTHENTICATED'});
    assert.equal((await f.pool.query('SELECT phone,status FROM people WHERE id=$1',[f.target.personId])).rows[0].phone,null);assert.equal((await f.pool.query('SELECT status FROM accounts WHERE id=$1',[f.target.accountId])).rows[0].status,'active');assert.equal((await f.pool.query('SELECT count(*)::int n FROM identity_lifecycle_operations')).rows[0].n,0);
  }finally{await f.pool.end();}
});
