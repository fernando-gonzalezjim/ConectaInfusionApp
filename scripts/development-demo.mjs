import { createHash, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { developmentDatabaseUrl } from '../apps/api/dist/modules/identity/bootstrap.js';
import { hashPassword } from '../apps/api/dist/modules/identity/passwords.js';
import { appendIdentityAudit } from '../apps/api/dist/modules/identity/audit.js';
import {createDemoPhotoFixture} from './development-photo-fixture.mjs';
import {seedDevelopmentFamilies} from './development-families.mjs';
import {seedDevelopmentDependents} from './development-dependents.mjs';

// Fictional local-only credentials. Never use this dataset in a deployed database.
export const demoPassword = 'ConectaDemo!2026';
const id = key => {
  const hex = createHash('sha256').update(`conecta-development-demo-v1:${key}`).digest('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
};
const personnel = [
  ['manager','Demo Manager',['manager','customer']],
  ['reception','Demo Reception',['reception','customer']],
  ['cafe','Demo Cafe Staff',['cafe_staff','customer']],
  ['instructor.yoga','Demo Yoga Instructor',['instructor','customer']],
  ['instructor.dance','Demo Dance Instructor',['instructor','customer']],
];
const customers = Array.from({length:18},(_,i)=>[`customer${String(i+1).padStart(2,'0')}`,`Demo Customer ${i+1}`,['customer']]);
const administrationStates=[['customer.pending','Demo Pending Customer',['customer']],['customer.inactive','Demo Inactive Customer',['customer']]];
const profileScenarios=[['customer.profile','Demo Profile Customer',['customer']]];

export async function seedDevelopmentDemo(pool, environment = process.env) {
  const target = developmentDatabaseUrl(environment);
  if (pool.options.connectionString !== environment.DATABASE_URL) throw new Error('DEVELOPMENT_DATABASE_MISMATCH');
  const client = await pool.connect();
  let createdAccounts = 0;
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('identity-active-administration',0))");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('conecta-development-demo-v1',0))");
    if ((await client.query('SELECT current_database() AS name')).rows[0].name !== target.pathname.slice(1)) throw new Error('DEVELOPMENT_DATABASE_MISMATCH');
    const operator = (await client.query(`SELECT a.id FROM accounts a JOIN people p ON p.id=a.person_id
      WHERE a.status='active' AND p.status='active' AND a.confirmation_status IN ('verified','exempt')
      AND EXISTS(SELECT 1 FROM account_roles r WHERE r.account_id=a.id AND r.role IN ('administrator','manager'))
      ORDER BY a.created_at,a.id LIMIT 1 FOR UPDATE OF a,p`)).rows[0];
    if (!operator) throw new Error('DEVELOPMENT_ADMIN_REQUIRED');
    const passwordHash = await hashPassword(demoPassword);
    for (const [key,name,roles] of [...personnel,...customers,...administrationStates,...profileScenarios]) {
      const personId=id(`person:${key}`), accountId=id(`account:${key}`), email=`${key}@demo.conecta.example.test`;
      const existing=(await client.query('SELECT id,person_id FROM accounts WHERE id=$1 OR email=$2 FOR UPDATE',[accountId,email])).rows;
      if (existing.length) {
        if(existing.length!==1||existing[0].id!==accountId||existing[0].person_id!==personId) throw new Error('DEVELOPMENT_DEMO_CONFLICT');
      } else {
        await client.query('INSERT INTO people(id,full_name,preferred_locale) VALUES ($1,$2,$3)',[personId,name,key==='customer18'?'en':'es-MX']);
        const status=key==='customer.pending'?'pending':key==='customer.inactive'?'inactive':'active';
        if(status==='pending')await client.query("INSERT INTO accounts(id,person_id,email,status,confirmation_status) VALUES ($1,$2,$3,'pending','pending')",[accountId,personId,email]);
        else if(key==='customer.profile')await client.query(`INSERT INTO accounts(id,person_id,email,password_hash,status,confirmation_status,email_verified_at)
          VALUES ($1,$2,$3,$4,'active','verified',now())`,[accountId,personId,email,passwordHash]);
        else await client.query(`INSERT INTO accounts(id,person_id,email,password_hash,status,confirmation_status,exemption_source,exemption_actor_id,exemption_reason,exemption_at)
          VALUES ($1,$2,$3,$4,'active','exempt','management',$5,'Fictional opt-in local demo dataset',now())`,[accountId,personId,email,passwordHash,operator.id]);
        if(status==='inactive'){
          await client.query("UPDATE accounts SET status='inactive',deactivated_at=now() WHERE id=$1",[accountId]);
          await client.query("UPDATE people SET status='inactive' WHERE id=$1",[personId]);
        }
        await client.query('INSERT INTO account_roles(account_id,role,assigned_by) SELECT $1,unnest($2::text[]),$3',[accountId,roles,operator.id]);
        await appendIdentityAudit(client,{actor:{id:'development-demo-script',type:'system'},action:'account.created',targetType:'account',targetId:accountId,
          before:null,after:{fullName:name,email,personId,status,roles,confirmationStatus:status==='pending'?'pending':key==='customer.profile'?'verified':'exempt',exemptionSource:status==='pending'||key==='customer.profile'?null:'management'},
          reason:key==='customer.profile'?'Fictional local mailbox-verification fixture for profile/email-change tests':'Fictional opt-in local demo dataset; confirmation bypassed for manual testing',correlationId:randomUUID()});
        createdAccounts++;
      }
      // Explicit links apply only to newly generated fictional identities, never adopt legacy users by email.
      if(key.startsWith('customer')) await client.query('INSERT INTO members(id,full_name,email,person_id) VALUES ($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING',[id(`member:${key}`),name,email,personId]);
      if(key.startsWith('instructor.')) await client.query('INSERT INTO instructors(id,full_name,person_id) VALUES ($1,$2,$3) ON CONFLICT(id) DO NOTHING',[id(`instructor:${key}`),name,personId]);
      if(key.startsWith('customer') && (await client.query('SELECT person_id FROM members WHERE id=$1',[id(`member:${key}`)])).rows[0]?.person_id!==personId) throw new Error('DEVELOPMENT_DEMO_CONFLICT');
      if(key.startsWith('instructor.') && (await client.query('SELECT person_id FROM instructors WHERE id=$1',[id(`instructor:${key}`)])).rows[0]?.person_id!==personId) throw new Error('DEVELOPMENT_DEMO_CONFLICT');
    }
    const slots=[['full','Demo: Yoga — full class','instructor.yoga',2],['available','Demo: K-pop — available places','instructor.dance',3],['past','Demo: Functional — past attendance','instructor.yoga',-2]];
    for (const [key,title,instructor,days] of slots) {
      await client.query(`INSERT INTO class_sessions(id,title,instructor_id,starts_at,duration_minutes,capacity)
        VALUES ($1,$2,$3,date_trunc('day',now())+($4::int * interval '1 day')+interval '18 hours',60,16) ON CONFLICT(id) DO NOTHING`,[id(`session:${key}`),title,id(`instructor:${instructor}`),days]);
    }
    const bookings=[...customers.slice(0,16).map(([key])=>[key,'full','confirmed']),
      ['customer17','available','confirmed'],['customer18','available','confirmed'],['customer01','available','cancelled'],
      ['customer01','past','attended'],['customer02','past','attended'],['customer03','past','no_show'],['customer04','past','cancelled']];
    for (const [customer,session,status] of bookings) {
      const bookingId=id(`booking:${customer}:${session}`),memberId=id(`member:${customer}`),sessionId=id(`session:${session}`);
      await client.query(`INSERT INTO bookings(id,member_id,class_session_id,status)
        VALUES ($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING`,[bookingId,memberId,sessionId,status]);
      const row=(await client.query('SELECT member_id,class_session_id FROM bookings WHERE id=$1',[bookingId])).rows[0];
      if(row.member_id!==memberId || row.class_session_id!==sessionId) throw new Error('DEVELOPMENT_DEMO_CONFLICT');
    }
    const familyFixtures=await seedDevelopmentFamilies(client,id);
    const dependentFixtures=await seedDevelopmentDependents(client,id);
    if(createdAccounts) await client.query(`INSERT INTO audit_events(actor_id,actor_type,action,target_type,target_id,changes,reason,correlation_id)
      VALUES ('development-demo-script','system','development.demo_seeded','dataset','conecta-development-demo-v1',$1,'Fictional local data only',$2)`,[JSON.stringify({createdAccounts,sessions:3,bookings:23}),randomUUID()]);
    await client.query('COMMIT');
    return {createdAccounts,accounts:26,instructors:2,customers:21,sessions:3,bookings:23,...familyFixtures,...dependentFixtures};
  } catch(error) {await client.query('ROLLBACK');throw error;}
  finally {client.release();}
}

if(process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let pool;
  try {
    if(process.argv.slice(2).join(' ')!=='--development') throw new Error('DEVELOPMENT_FLAG_REQUIRED');
    developmentDatabaseUrl(process.env);
    pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:5000,statement_timeout:15000});
    console.log(await seedDevelopmentDemo(pool));
    await createDemoPhotoFixture();
    console.log('Reusable photo upload fixture: .local/demo-profile.png (existing files are preserved).');
    console.log('Demo dataset ready. Login examples and development-only password: docs/development-demo.md');
    console.log('Management audit testing: use the demo manager and View history; seeded account events already cover pagination.');
    console.log('Family screen testing: customer.profile/customer01 share a family; open My family and invite unassigned customer02; management can Assist family. See docs/identity-families.md.');
    console.log('Successor testing: the current responsible member can offer responsibility to another current member; customer.profile/customer01 provide the initial scenario. Accept or decline through the local inbox; seeding never creates offers or consent.');
    console.log('Dependent persistence: one no-login child has customer.profile/customer01 as fictional guardians; customer18 has reusable child details without a profile. A second inactive child has customer18 as its immediately prior guardian for explicit renewal testing. No child booking or renewal acceptance is seeded. See docs/identity-dependents.md.');
  } catch(error) {
    const known=/^(DEVELOPMENT_FLAG_REQUIRED|DEVELOPMENT_FIXTURES_DISABLED|UNSAFE_DEVELOPMENT_DATABASE|DEVELOPMENT_DATABASE_MISMATCH|DEVELOPMENT_ADMIN_REQUIRED|DEVELOPMENT_DEMO_CONFLICT)$/;
    console.error(known.test(error.message)?error.message:'DEVELOPMENT_DEMO_FAILED');
    if(error.message==='DEVELOPMENT_ADMIN_REQUIRED') console.error('Bootstrap the first administrator in conecta_dev before seeding. See the first-admin commands in docs/development-demo.md. After db:clean:demo, bootstrap again.');
    process.exitCode=1;
  } finally {if(pool) await pool.end();}
}
