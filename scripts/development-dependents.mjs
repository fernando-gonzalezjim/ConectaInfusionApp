import {randomUUID} from 'node:crypto';

// Only called inside development-demo.mjs's guarded transaction. Relationships
// are explicit fictional acceptance provenance, not real-user consent or email.
export async function seedDevelopmentDependents(client,id){
  const personId=id('dependent:profile-child'),creatorId=id('account:customer.profile');
  let createdProfiles=0,createdDetails=0;
  const existing=(await client.query('SELECT created_by_account_id FROM dependent_profiles WHERE person_id=$1 FOR UPDATE',[personId])).rows[0];
  if(existing){
    const original=(await client.query("SELECT guardian_account_id FROM dependent_guardians WHERE dependent_person_id=$1 AND source='creation'",[personId])).rows[0];
    if(existing.created_by_account_id!==creatorId||original?.guardian_account_id!==creatorId)throw new Error('DEVELOPMENT_DEMO_CONFLICT');
    // Preserve profile edits, deactivation/transition and ended authorizations.
  }else{
    if((await client.query('SELECT 1 FROM people WHERE id=$1',[personId])).rowCount)throw new Error('DEVELOPMENT_DEMO_CONFLICT');
    await client.query("INSERT INTO people(id,full_name) VALUES ($1,'Demo Dependent Child')",[personId]);
    await client.query("INSERT INTO dependent_profiles(person_id,age_text,created_by_account_id) VALUES ($1,'8 years',$2)",[personId,creatorId]);
    await client.query("INSERT INTO dependent_guardians(id,dependent_person_id,guardian_account_id,source,accepted_by_account_id) VALUES ($1,$2,$3,'creation',$3)",[id('guardian:profile-child:creator'),personId,creatorId]);
    const otherId=id('account:customer01');
    await client.query("INSERT INTO guardian_consent_exceptions(relationship_id,reason) VALUES ($1,'development_fixture')",[id('guardian:profile-child:other')]);
    await client.query("INSERT INTO dependent_guardians(id,dependent_person_id,guardian_account_id,source,accepted_by_account_id,accepted_invitation_id) VALUES ($1,$2,$3,'accepted_invitation',$3,$4)",[id('guardian:profile-child:other'),personId,otherId,id('guardian-consent:profile-child:other')]);
    createdProfiles++;
  }
  for(const [key,owner,name,age,dependentId] of [
    ['profile-child','customer.profile','Demo Dependent Child','8 years',personId],
    ['saved-only-child','customer18','Demo Saved Child','6 years',null],
  ]){
    const detailId=id(`saved-child:${key}`),ownerId=id(`account:${owner}`);
    const detail=(await client.query('SELECT owner_account_id FROM saved_child_details WHERE id=$1 FOR UPDATE',[detailId])).rows[0];
    if(detail){if(detail.owner_account_id!==ownerId)throw new Error('DEVELOPMENT_DEMO_CONFLICT');continue;}
    await client.query('INSERT INTO saved_child_details(id,owner_account_id,child_name,age_text,dependent_person_id) VALUES ($1,$2,$3,$4,$5)',[detailId,ownerId,name,age,dependentId]);
    createdDetails++;
  }
  if(createdProfiles||createdDetails)await client.query(`INSERT INTO audit_events(actor_id,actor_type,action,target_type,target_id,changes,reason,correlation_id)
    VALUES ('development-demo-script','system','development.dependents_seeded','dataset','conecta-development-demo-v1',$1,'Fictional local child/guardian data; no email, login, booking or financial mutation',$2)`,[JSON.stringify({createdProfiles,createdDetails}),randomUUID()]);
  return {dependentProfiles:1,guardianRelationships:2,savedChildDetails:2};
}
