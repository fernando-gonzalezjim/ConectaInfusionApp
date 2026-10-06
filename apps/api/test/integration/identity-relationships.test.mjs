import test from 'node:test';
import assert from 'node:assert/strict';
import {isolatedDatabase,migrate} from './identity-helpers.mjs';
import {authConfig,createAuthAccount,password} from './identity-auth-helpers.mjs';
import {createSessionService} from '../../dist/modules/identity/sessions.js';
import {createChildDetailsService} from '../../dist/modules/identity/child-details.js';
import {createFamilyInvitationService} from '../../dist/modules/identity/family-invitations.js';
import {decryptOutboxPayload} from '../../dist/modules/identity/outbox-crypto.js';

test('relationship HTTP permission matrix separates management, membership and guardianship without granting pending consent',async()=>{
  const db=await isolatedDatabase(),previous=process.env.DATABASE_URL;let server;
  try{
    migrate(db.name);const config=authConfig(),sessions=await createSessionService(db.pool,config),families=createFamilyInvitationService(db.pool,config,sessions);
    async function account(key,roles){const value=await createAuthAccount(db.pool,`${key}@example.test`,roles);return {...value,...await sessions.login({email:value.email,password},'127.0.0.1')};}
    const owner=await account('owner',['customer']),member=await account('member',['customer','instructor']),outsider=await account('outsider',['customer']);
    const family=await families.create({name:'Permission matrix family'},owner.sessionToken);
    await families.invite(family.id,{email:member.email},owner.sessionToken,'127.0.0.1');
    const row=(await db.pool.query("SELECT o.* FROM identity_email_outbox o JOIN identity_action_tokens t ON t.id=o.action_token_id WHERE t.purpose='family_invitation'")).rows[0];
    const raw=JSON.parse(decryptOutboxPayload({keyId:row.key_id,nonce:row.nonce,authTag:row.auth_tag,ciphertext:row.ciphertext},{outboxId:row.id,actionTokenId:row.action_token_id,kind:'action',recipientHash:row.recipient_hash},config.secrets)).token;
    await families.accept({token:raw},member.sessionToken,'127.0.0.1');
    const child=await createChildDetailsService(db.pool,sessions).createDependent({fullName:'Matrix dependent',ageText:'8'},owner.sessionToken);
    const actors=[['owner',owner,true,true],['member',member,false,true],['outsider',outsider,false,false]];
    for(const role of ['administrator','manager','reception','cafe_staff','instructor'])actors.push([role,await account(role,[role]),false,false]);
    process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/unused';
    const {createApplication}=await import('../../dist/app.js');server=(await createApplication({database:db.pool,identityConfig:config,environment:{NODE_ENV:'test'}})).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
    const base=`http://127.0.0.1:${server.address().port}/api/v1`,Origin='http://localhost:5173';
    for(const [key,actor,guardian,inFamily] of actors){
      // The matrix intentionally probes many mutations from one loopback IP.
      // Reset only its isolated test bucket; product throttles remain unchanged.
      await db.pool.query("DELETE FROM identity_throttles WHERE scope='registration_ip'");
      const management=['administrator','manager'].includes(key);
      const headers={Origin,Cookie:`conecta_session=${actor.sessionToken}`};
      async function check(path,status,body){const response=await fetch(base+path,{headers:body===undefined?headers:{...headers,'Content-Type':'application/json','X-CSRF-Token':actor.csrfToken},...(body===undefined?{}:{method:'POST',body:JSON.stringify(body)})});assert.equal(response.status,status,`${key}: ${path}`);assert.equal(response.headers.get('cache-control'),'no-store');return response;}
      await check('/families/for-account/'+owner.accountId,management?200:403);
      await check('/families/'+family.id,management||inFamily?200:403);
      const responsibility=await check('/families/'+family.id+'/responsibility',management||inFamily?200:403);
      if(responsibility.ok)assert.equal((await responsibility.json()).canNominate,management||guardian);
      await check('/dependents/'+child.id,guardian?200:actor.account.roles.includes('customer')?404:403);
      await check('/dependents/guardian-invitations/for-account/'+owner.accountId,management?200:403);
      await check('/dependents/'+child.id+'/guardians',management||guardian?200:404);
      await check('/families/'+family.id+'/invitations',management||inFamily?202:403,{email:`pending-family-${key}@example.test`});
      await check('/families/'+family.id+'/successor-offers',management||guardian?202:403,{email:member.email});
      await check('/dependents/'+child.id+'/guardian-invitations',management||guardian?202:404,{email:`pending-guardian-${key}@example.test`});
      await check('/dependents/'+child.id+'/transition',guardian?202:404,{email:`independent-${key}@example.test`});
      // Domain-coordinated operations remain absent, even for privileged actors.
      await check('/families/'+family.id+'/close',404,{});
      await check('/dependents/'+child.id+'/deactivate',404,{});
    }
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM family_memberships WHERE family_id=$1 AND ended_at IS NULL',[family.id])).rows[0].n,2);
    assert.equal((await db.pool.query('SELECT responsible_membership_id FROM families WHERE id=$1',[family.id])).rows[0].responsible_membership_id,family.responsibleMembershipId);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM dependent_guardians WHERE dependent_person_id=$1 AND ended_at IS NULL',[child.id])).rows[0].n,1);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM accounts WHERE person_id=$1',[child.id])).rows[0].n,0);
  }finally{
    if(server)await new Promise(r=>server.close(r));if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;await db.pool.end();
  }
});
