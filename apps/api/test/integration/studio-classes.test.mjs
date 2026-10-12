import test from 'node:test';
import assert from 'node:assert/strict';
import {isolatedDatabase,migrate} from './identity-helpers.mjs';
import {authConfig,createAuthAccount,password} from './identity-auth-helpers.mjs';
import {createSessionService} from '../../dist/modules/identity/sessions.js';
import {createAccountService} from '../../dist/modules/identity/accounts.js';
import {createDisciplineService} from '../../dist/modules/studio/disciplines.js';
import {createClassService} from '../../dist/modules/studio/classes.js';
import {createClassRouter} from '../../dist/modules/studio/class-routes.js';
import express from 'express';

async function fixture(){
  const db=await isolatedDatabase();migrate(db.name);
  const sessions=await createSessionService(db.pool,authConfig(),{environment:{NODE_ENV:'test'}});
  const administration=createAccountService(db.pool,sessions);
  const classes=createClassService(administration),disciplines=createDisciplineService(administration);
  const actor=async role=>{const email=`${role}@example.test`;return {...await createAuthAccount(db.pool,email,[role]),...await sessions.login({email,password},'127.0.0.1')};};
  return {...db,sessions,classes,disciplines,actor};
}
const base=disciplineId=>({disciplineId,nameEs:'Yoga',audience:'adults',level:'all'});

test('reusable classes validate facts, preserve generated colors and guard parent publication',async()=>{
  const f=await fixture();try{
    const manager=await f.actor('manager'),token=manager.sessionToken;
    const parent=await f.disciplines.create({nameEs:'Yoga'},token);
    const row=await f.classes.create(base(parent.id),token);
    assert.match(row.color,/^#[0-9a-f]{6}$/i);assert.equal(row.durationMinutes,55);assert.equal(row.minAge,null);
    assert.equal(row.version,1);assert.equal(row.status,'draft');
    for(const patch of [{durationMinutes:60},{price:1},{audience:'teen'},{level:'expert'},{color:'red'},
      {minAge:2},{audience:'children',minAge:12,maxAge:6},{audience:'children',minAge:1.5},
      {status:'published',descriptionEs:'Ready'}]){
      await assert.rejects(f.classes.create({...base(parent.id),...patch},token));
    }
    const edited=await f.classes.update(row.id,{nameEs:'New yoga',expectedVersion:1},token);
    assert.equal(edited.color,row.color);assert.equal(edited.version,2);
    await assert.rejects(f.classes.update(row.id,{expectedVersion:1,color:'#ffffff'},token),{message:'CONFLICT'});
    await f.disciplines.update(parent.id,{descriptionEs:'Published',status:'published',expectedVersion:1},token);
    const published=await f.classes.update(row.id,{descriptionEs:'Published',status:'published',expectedVersion:2},token);
    assert.equal(published.status,'published');
    const child=await f.classes.create({...base(parent.id),audience:'children',minAge:6,maxAge:12,level:'beginner'},token);
    assert.equal(child.minAge,6);assert.equal(child.maxAge,12);
    const page=await f.classes.list({limit:'1'},token);assert.equal(page.items.length,1);assert.ok(page.nextCursor);
    assert.equal((await f.classes.list({limit:'1',cursor:page.nextCursor},token)).items.length,1);
    assert.equal((await f.pool.query("SELECT count(*)::int n FROM audit_events WHERE action='studio.class_created'")).rows[0].n,2);
  }finally{await f.pool.end();}
});

test('staff can change only class color and current-role demotion cannot authorize a write',async()=>{
  const f=await fixture();try{
    const manager=await f.actor('manager');const parent=await f.disciplines.create({nameEs:'Yoga'},manager.sessionToken);
    const row=await f.classes.create(base(parent.id),manager.sessionToken);
    let version=1;
    for(const role of ['reception','cafe_staff','instructor']){
      const actor=await f.actor(role);
      await assert.rejects(f.classes.create(base(parent.id),actor.sessionToken),{message:'FORBIDDEN'});
      await assert.rejects(f.classes.update(row.id,{nameEs:'Forged',expectedVersion:version},actor.sessionToken),{message:'FORBIDDEN'});
      await assert.rejects(f.classes.updateColor(row.id,{color:'#123456',nameEs:'Forged',expectedVersion:version},actor.sessionToken),{message:'INVALID_REQUEST'});
      const changed=await f.classes.updateColor(row.id,{color:'#123456',expectedVersion:version},actor.sessionToken);
      assert.equal(changed.color,'#123456');assert.equal(changed.nameEs,'Yoga');version++;
    }
    const customer=await f.actor('customer');
    await assert.rejects(f.classes.updateColor(row.id,{color:'#abcdef',expectedVersion:version},customer.sessionToken),{message:'FORBIDDEN'});
    await f.pool.query("DELETE FROM account_roles WHERE account_id=$1",[manager.accountId]);
    await assert.rejects(f.classes.update(row.id,{nameEs:'Demoted',expectedVersion:version},manager.sessionToken),{message:'FORBIDDEN'});
  }finally{await f.pool.end();}
});

test('class archive and eligibility guards preserve reserved history and writes roll back with audit failure',async()=>{
  const f=await fixture();try{
    const manager=await f.actor('manager'),token=manager.sessionToken;
    const parent=await f.disciplines.create({nameEs:'Yoga'},token),row=await f.classes.create(base(parent.id),token);
    const session=(await f.pool.query(`INSERT INTO class_sessions(title,class_id,status,starts_at,duration_minutes,capacity)
      VALUES ('Future draft',$1,'draft',now()+interval '1 year',55,16) RETURNING id`,[row.id])).rows[0].id;
    await assert.rejects(f.classes.update(row.id,{status:'archived',expectedVersion:1},token),{message:'CONFLICT'});
    const member=(await f.pool.query("INSERT INTO members(full_name,email) VALUES ('Fictional','reserved@example.test') RETURNING id")).rows[0].id;
    await f.pool.query('INSERT INTO bookings(member_id,class_session_id) VALUES ($1,$2)',[member,session]);
    await assert.rejects(f.classes.update(row.id,{audience:'children',minAge:6,maxAge:12,expectedVersion:1},token),{message:'CONFLICT'});
    assert.equal((await f.pool.query('SELECT status FROM bookings WHERE class_session_id=$1',[session])).rows[0].status,'confirmed');
    const [a,b]=await Promise.allSettled([
      f.classes.update(row.id,{nameEs:'Concurrent A',expectedVersion:1},token),
      f.classes.update(row.id,{nameEs:'Concurrent B',expectedVersion:1},token)
    ]);
    assert.equal([a,b].filter(r=>r.status==='fulfilled').length,1);
    assert.equal([a,b].find(r=>r.status==='rejected').reason.message,'CONFLICT');
    await f.pool.query(`CREATE FUNCTION reject_class_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.action LIKE 'studio.class_%' THEN RAISE EXCEPTION 'Injected audit failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_class_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_class_audit()`);
    await assert.rejects(f.classes.updateColor(row.id,{color:'#ffffff',expectedVersion:2},token),/Injected audit failure/);
    const retained=(await f.pool.query('SELECT color,version FROM studio_classes WHERE id=$1',[row.id])).rows[0];
    assert.equal(retained.color,row.color);assert.equal(retained.version,2);
  }finally{await f.pool.end();}
});

test('class route guard precedes parsing and staff cannot smuggle catalog properties through color writes',async()=>{
  const f=await fixture();let server;try{
    const actor=await f.actor('manager'),staff=await f.actor('reception');
    const parent=await f.disciplines.create({nameEs:'Yoga'},actor.sessionToken);
    const row=await f.classes.create(base(parent.id),actor.sessionToken);
    const app=express();app.use('/classes',createClassRouter(f.classes,(req,res,next)=>{
      if(req.headers.origin!=='https://management.example.test'||req.headers['x-csrf-token']!=='test-token')res.status(403).json({code:'FORBIDDEN'});
      else next();
    }));
    server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve));
    const address=`http://127.0.0.1:${server.address().port}/classes`;
    const cookie=`conecta_session=${staff.sessionToken}`;
    const denied=await fetch(`${address}/${row.id}/color`,{method:'POST',headers:{'content-type':'application/json'},body:'{'});
    assert.equal(denied.status,403);assert.equal(denied.headers.get('cache-control'),'no-store');
    const headers={'content-type':'application/json',origin:'https://management.example.test','x-csrf-token':'test-token',
      cookie};
    const invalid=await fetch(`${address}/${row.id}/color`,{method:'POST',headers,body:JSON.stringify({color:'#abcdef',expectedVersion:1,nameEs:'Smuggled'})});
    assert.equal(invalid.status,400);
    const changed=await fetch(`${address}/${row.id}/color`,{method:'POST',headers,body:JSON.stringify({color:'#abcdef',expectedVersion:1})});
    assert.equal(changed.status,200);assert.equal((await changed.json()).nameEs,'Yoga');
  }finally{if(server)await new Promise(resolve=>server.close(resolve));await f.pool.end();}
});

test('class creation waiting for a parent row lock cannot write after session expiry',async()=>{
  const f=await fixture();const holder=await f.pool.connect();let queued;try{
    const actor=await f.actor('manager'),parent=await f.disciplines.create({nameEs:'Yoga'},actor.sessionToken);
    const session=await f.sessions.resolve(actor.sessionToken);
    await holder.query('BEGIN');await holder.query('SELECT id FROM studio_disciplines WHERE id=$1 FOR UPDATE',[parent.id]);
    await f.pool.query(`WITH boundary AS (SELECT clock_timestamp()+interval '2 seconds' AS expiry)
      UPDATE identity_sessions SET expires_at=boundary.expiry,created_at=boundary.expiry-interval '168 hours',
      authenticated_at=boundary.expiry-interval '1 hour' FROM boundary WHERE id=$1`,[session.sessionId]);
    let authorized;const gate=new Promise(resolve=>{authorized=resolve;});
    const accounts=createAccountService(f.pool,f.sessions),service=createClassService({
      withStaffRead:accounts.withStaffRead,
      withManagementRead:(token,work)=>accounts.withManagementRead(token,(client,context)=>{authorized(context);return work(client,context);})
    });
    queued=service.create(base(parent.id),actor.sessionToken).then(value=>({value}),error=>({error}));
    const context=await gate;
    await new Promise(resolve=>setTimeout(resolve,Math.max(0,Date.parse(context.expiresAt)-Date.now()+50)));
    await holder.query('COMMIT');
    assert.equal((await queued).error?.message,'UNAUTHENTICATED');
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM studio_classes')).rows[0].n,0);
    assert.equal((await f.pool.query("SELECT count(*)::int n FROM audit_events WHERE action='studio.class_created'")).rows[0].n,0);
  }finally{await holder.query('ROLLBACK');holder.release();if(queued)await queued;await f.pool.end();}
});
