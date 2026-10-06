import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {isolatedDatabase,migrate} from './identity-helpers.mjs';
import {createAuthAccount} from './identity-auth-helpers.mjs';
import {createIdentityLifecycleComposition} from '../../dist/composition/identity-lifecycle.js';

const ready={atomic:true,audit:true,preservesHistory:true};
async function fixture(){const db=await isolatedDatabase();migrate(db.name);const actor=await createAuthAccount(db.pool,'actor@example.test',['manager']),target=await createAuthAccount(db.pool,'target@example.test');return {...db,actor,target,request:{actorAccountId:actor.accountId,operation:'account-deactivation',personIds:[target.personId],identityRevision:'identity-v1'}};}
async function transaction(pool,work){const client=await pool.connect();try{await client.query('BEGIN');const result=await work(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
function adapters(revision='domain-v1',apply=async()=>{}){return ['credits-bookings','studio-catalog','instructor-payroll'].map(domain=>({domain,tables:[],handlesLegacy:true,inspect:async()=>({status:'ready',revision,assurances:ready}),apply:async(client,plan)=>{await apply(client,plan);return {status:'applied',revision};}}));}

test('missing owning coordinators and missing/unknown schemas never prove no obligations',async()=>{
  const f=await fixture();try{
    const service=createIdentityLifecycleComposition();const preview=await transaction(f.pool,c=>service.preview(c,f.request));assert.equal(preview.status,'blocked');assert.ok(preview.reasons.includes('INTEGRATION_REQUIRED'));
    await f.pool.query('CREATE TABLE unknown_credits(id uuid PRIMARY KEY)');const configured=createIdentityLifecycleComposition(adapters());assert.ok((await transaction(f.pool,c=>configured.preview(c,f.request))).reasons.includes('UNKNOWN_SCHEMA'));
    await f.pool.query('DROP TABLE unknown_credits');await f.pool.query('ALTER TABLE bookings RENAME TO missing_bookings');assert.ok((await transaction(f.pool,c=>configured.preview(c,f.request))).reasons.includes('UNKNOWN_SCHEMA'));
  }finally{await f.pool.end();}
});

test('legacy attendee/email and ambiguous teaching obligations require explicit legacy support',async()=>{
  const f=await fixture();try{
    const member=(await f.pool.query('INSERT INTO members(full_name,email) VALUES ($1,$2) RETURNING id',['Legacy target',f.target.email])).rows[0].id;
    const instructor=(await f.pool.query("INSERT INTO instructors(full_name) VALUES ('Unlinked teacher') RETURNING id")).rows[0].id;
    const session=(await f.pool.query("INSERT INTO class_sessions(title,instructor_id,starts_at,duration_minutes,capacity) VALUES ('Legacy class',$1,now()+interval '1 day',60,16) RETURNING id",[instructor])).rows[0].id;
    await f.pool.query('INSERT INTO bookings(member_id,class_session_id) VALUES ($1,$2)',[member,session]);
    const configured=createIdentityLifecycleComposition(adapters().map(a=>({...a,handlesLegacy:false}))),preview=await transaction(f.pool,c=>configured.preview(c,f.request));assert.equal(preview.status,'blocked');assert.ok(preview.reasons.includes('LEGACY_OBLIGATIONS'));
    assert.equal((await f.pool.query('SELECT status FROM bookings')).rows[0].status,'confirmed');
  }finally{await f.pool.end();}
});

test('stale preview, failed coordinator and failed identity work roll back all effects and permit same-key retry',async()=>{
  const f=await fixture();try{
    const first=createIdentityLifecycleComposition(adapters()),preview=await transaction(f.pool,c=>first.preview(c,f.request));assert.equal(preview.status,'ready');
    const key=randomUUID(),execution={...f.request,idempotencyKey:key,expectedRevision:preview.revision};
    await assert.rejects(transaction(f.pool,c=>createIdentityLifecycleComposition(adapters('domain-v2')).execute(c,execution,async()=>{})),{message:'CONFLICT'});
    const failing=createIdentityLifecycleComposition(adapters('domain-v1',async client=>{await client.query("UPDATE people SET phone='must roll back' WHERE id=$1",[f.target.personId]);throw new Error('controlled coordinator failure');}));
    await assert.rejects(transaction(f.pool,c=>failing.execute(c,execution,async()=>{})),{message:'controlled coordinator failure'});
    await assert.rejects(transaction(f.pool,c=>first.execute(c,execution,async same=>{await same.query("UPDATE people SET phone='must roll back' WHERE id=$1",[f.target.personId]);throw new Error('controlled identity failure');})),{message:'controlled identity failure'});
    assert.equal((await f.pool.query('SELECT phone FROM people WHERE id=$1',[f.target.personId])).rows[0].phone,null);assert.equal((await f.pool.query('SELECT count(*)::int n FROM identity_lifecycle_operations')).rows[0].n,0);
    let calls=0;const result=await transaction(f.pool,c=>first.execute(c,execution,async same=>{calls++;await same.query("UPDATE people SET phone='committed once' WHERE id=$1",[f.target.personId]);}));
    const replay=await transaction(f.pool,c=>first.execute(c,execution,async()=>{calls++;}));assert.deepEqual(replay,result);assert.equal(calls,1);
    await assert.rejects(transaction(f.pool,c=>first.execute(c,{...execution,identityRevision:'different identity'},async()=>{})),{message:'CONFLICT'});
  }finally{await f.pool.end();}
});

test('concurrent retries commit one operation and callers must own an explicit transaction',async()=>{
  const f=await fixture();try{
    const service=createIdentityLifecycleComposition(adapters()),preview=await transaction(f.pool,c=>service.preview(c,f.request));const execution={...f.request,idempotencyKey:randomUUID(),expectedRevision:preview.revision};let calls=0;
    const results=await Promise.all([1,2].map(()=>transaction(f.pool,c=>service.execute(c,execution,async()=>{calls++;}))));assert.deepEqual(results[0],results[1]);assert.equal(calls,1);
    const client=await f.pool.connect();try{await assert.rejects(service.preview(client,f.request));}finally{client.release();}
  }finally{await f.pool.end();}
});

test('preview writes cannot leak and transaction-control mistakes cannot escape rollback even when caught',async()=>{
  const f=await fixture();try{
    const inspection=adapters();inspection[0].inspect=async client=>{await client.query("UPDATE people SET phone='preview write' WHERE id=$1",[f.target.personId]);return {status:'ready',revision:'domain-v1',assurances:ready};};
    await transaction(f.pool,c=>createIdentityLifecycleComposition(inspection).preview(c,f.request));assert.equal((await f.pool.query('SELECT phone FROM people WHERE id=$1',[f.target.personId])).rows[0].phone,null);
    const service=createIdentityLifecycleComposition(adapters()),preview=await transaction(f.pool,c=>service.preview(c,f.request));
    for(const command of ['COMMIT',' /* hidden */ COMMIT','SELECT 1; COMMIT','ROLLBACK TO SAVEPOINT identity_lifecycle_guard']){
      await transaction(f.pool,async client=>{
        await assert.rejects(service.execute(client,{...f.request,idempotencyKey:randomUUID(),expectedRevision:preview.revision},async same=>{assert.equal(same.release,undefined);await same.query("UPDATE people SET phone='must roll back' WHERE id=$1",[f.target.personId]);await same.query(command);}),{message:'LIFECYCLE_TRANSACTION_CONTROL_FORBIDDEN'});
      });
      assert.equal((await f.pool.query('SELECT phone FROM people WHERE id=$1',[f.target.personId])).rows[0].phone,null);
    }
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM identity_lifecycle_operations')).rows[0].n,0);
    await transaction(f.pool,async client=>{
      const childId=randomUUID();await client.query("INSERT INTO people(id,full_name) VALUES ($1,'New guarded child')",[childId]);
      await client.query("INSERT INTO dependent_profiles(person_id,age_text,created_by_account_id) VALUES ($1,'8',$2)",[childId,f.target.accountId]);
      await client.query("INSERT INTO dependent_guardians(id,dependent_person_id,guardian_account_id,source,accepted_by_account_id) VALUES ($1,$2,$3,'creation',$3)",[randomUUID(),childId,f.target.accountId]);
    });
    await assert.rejects(transaction(f.pool,c=>service.execute(c,{...f.request,idempotencyKey:randomUUID(),expectedRevision:preview.revision},async()=>{})),{message:'CONFLICT'});
    const currentPreview=await transaction(f.pool,c=>service.preview(c,f.request));
    await f.pool.query('UPDATE accounts SET session_version=session_version+1 WHERE id=$1',[f.target.accountId]);
    await assert.rejects(transaction(f.pool,c=>service.execute(c,{...f.request,idempotencyKey:randomUUID(),expectedRevision:currentPreview.revision},async()=>{})),{message:'CONFLICT'});
  }finally{await f.pool.end();}
});

test('audit failure removes every partial effect and completed receipts cannot be rewritten',async()=>{
  const f=await fixture();try{
    const service=createIdentityLifecycleComposition(adapters()),preview=await transaction(f.pool,c=>service.preview(c,f.request)),execution={...f.request,idempotencyKey:randomUUID(),expectedRevision:preview.revision};
    await f.pool.query("CREATE FUNCTION reject_lifecycle_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='identity.lifecycle_applied' THEN RAISE EXCEPTION 'controlled lifecycle audit failure'; END IF; RETURN NEW; END $$");await f.pool.query('CREATE TRIGGER reject_lifecycle_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_lifecycle_audit()');
    await transaction(f.pool,async client=>{await assert.rejects(service.execute(client,execution,async same=>{await same.query("UPDATE people SET phone='must roll back' WHERE id=$1",[f.target.personId]);}),{message:'controlled lifecycle audit failure'});});
    assert.equal((await f.pool.query('SELECT phone FROM people WHERE id=$1',[f.target.personId])).rows[0].phone,null);assert.equal((await f.pool.query('SELECT count(*)::int n FROM identity_lifecycle_operations')).rows[0].n,0);
    await f.pool.query('DROP TRIGGER reject_lifecycle_audit ON audit_events');const receipt=await transaction(f.pool,c=>service.execute(c,execution,async()=>{}));
    await assert.rejects(f.pool.query('UPDATE identity_lifecycle_operations SET completed_at=clock_timestamp() WHERE id=$1',[receipt.operationId]),{message:'Identity lifecycle receipts are immutable'});
    await assert.rejects(f.pool.query('DELETE FROM identity_lifecycle_operations WHERE id=$1',[receipt.operationId]),{message:'Identity lifecycle receipts are immutable'});
    assert.equal((await f.pool.query("SELECT actor_type FROM audit_events WHERE action='identity.lifecycle_applied'")).rows[0].actor_type,'staff');
  }finally{await f.pool.end();}
});

test('V13 upgrades populated V12 without default execution and conflicting DDL rolls back',async()=>{
  const db=await isolatedDatabase();try{migrate(db.name,'-target=12');const account=await createAuthAccount(db.pool);migrate(db.name);migrate(db.name);assert.equal((await db.pool.query('SELECT email FROM accounts WHERE id=$1',[account.accountId])).rows[0].email,account.email);assert.equal((await db.pool.query('SELECT count(*)::int n FROM identity_lifecycle_operations')).rows[0].n,0);}finally{await db.pool.end();}
  const collision=await isolatedDatabase();try{migrate(collision.name,'-target=12');await collision.pool.query('CREATE TABLE identity_lifecycle_operations(id uuid)');assert.throws(()=>migrate(collision.name));assert.equal((await collision.pool.query("SELECT count(*)::int n FROM pg_proc WHERE proname='protect_identity_lifecycle_receipts'")).rows[0].n,0);}finally{await collision.pool.end();}
});
