import {randomUUID} from 'node:crypto';
import {createFamilyInTransaction,joinFamilyInTransaction} from '../apps/api/dist/modules/identity/families.js';

// Called only within the guarded development seed transaction. Acceptance is
// fictional fixture data, not a real invitation or an invitation bypass route.
export async function seedDevelopmentFamilies(client,id) {
  const context={actor:{id:'development-demo-script',type:'system'},reason:'Fictional local family and accepted-consent fixture; no email or credit mutation',correlationId:randomUUID()};
  for(const [key,name,creator,invitee] of [
    ['shared','Demo shared family','customer.profile','customer01'],
    ['solo','Demo solo family','customer18',null],
  ]) {
    const familyId=id(`family:${key}`),creatorId=id(`person:${creator}`),membershipId=id(`family-member:${key}:${creator}`);
    const existing=(await client.query('SELECT * FROM families WHERE id=$1 FOR UPDATE',[familyId])).rows[0];
    if(existing) {
      const original=(await client.query('SELECT person_id,family_id,source FROM family_memberships WHERE id=$1',[membershipId])).rows[0];
      if(existing.created_by_person_id!==creatorId||original?.person_id!==creatorId||original?.family_id!==familyId||original?.source!=='creation')throw new Error('DEVELOPMENT_DEMO_CONFLICT');
      // Preserve manual edits and departures. Never resurrect a membership.
      continue;
    }
    const family=await createFamilyInTransaction(client,{id:familyId,membershipId,name,creatorPersonId:creatorId},context);
    if(invitee) {
      const personId=id(`person:${invitee}`);
      await joinFamilyInTransaction(client,{familyId,personId,expectedVersion:family.version,membershipId:id(`family-member:${key}:${invitee}`),
        acceptance:{invitationId:id(`family-consent:${key}:${invitee}`),acceptedByPersonId:personId,acceptedAt:new Date()}},context);
    }
  }
  return {families:2,familyMemberships:3};
}
