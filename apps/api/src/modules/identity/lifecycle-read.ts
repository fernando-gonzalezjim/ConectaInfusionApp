import type {Pool} from 'pg';
import {AuthError,type SessionService} from './sessions.js';
import {reactivationId as id,reactivationTransaction} from './reactivation.js';
export function createLifecycleReadService(pool:Pool,sessions:SessionService){
 return {
  async account(target:unknown,token:unknown){
   const accountId=id(target),actor=await sessions.resolve(token),management=actor.account.roles.some(r=>['administrator','manager'].includes(r));
   if(!management&&actor.account.id!==accountId)throw new AuthError('FORBIDDEN');
   return reactivationTransaction(pool,sessions,token,[accountId],[],management,async(c,_context,state)=>{
    const a=state.accounts.find(a=>a.id===accountId);if(!a)throw new AuthError('NOT_FOUND');
    const dependents=(await c.query<{id:string;fullName:string;canDeactivateTogether:boolean}>(`SELECT p.id,p.full_name AS "fullName",NOT EXISTS(SELECT 1 FROM dependent_guardians other JOIN accounts oa ON oa.id=other.guardian_account_id JOIN people op ON op.id=oa.person_id JOIN account_roles r ON r.account_id=oa.id AND r.role='customer' WHERE other.dependent_person_id=p.id AND other.ended_at IS NULL AND other.guardian_account_id<>$1 AND oa.status='active' AND op.status='active' AND oa.confirmation_status IN ('verified','exempt')) AS "canDeactivateTogether" FROM dependent_guardians g JOIN people p ON p.id=g.dependent_person_id JOIN dependent_profiles d ON d.person_id=p.id WHERE g.guardian_account_id=$1 AND g.ended_at IS NULL AND p.status='active' AND d.independent_at IS NULL ORDER BY p.id LIMIT 100`,[accountId])).rows;
    return {accountId:a.id,status:a.status,sessionVersion:a.session_version,dependents};
   });
  },
  async candidates(query:Record<string,unknown>,token:unknown){
   const limit=query.limit===undefined?25:Number(query.limit);if(query.limit!==undefined&&typeof query.limit!=='string'||Object.keys(query).some(k=>!['limit','cursor'].includes(k))||!Number.isInteger(limit)||limit<1||limit>25)throw new AuthError('INVALID_REQUEST');const cursor=query.cursor===undefined?null:id(query.cursor);
   return reactivationTransaction(pool,sessions,token,[],[],true,async c=>{
    const rows=(await c.query<{id:string;fullName:string}>(`SELECT p.id,p.full_name AS "fullName" FROM dependent_profiles d JOIN people p ON p.id=d.person_id WHERE p.status='inactive' AND d.independent_at IS NULL AND d.deactivation_sequence>0 AND ($1::uuid IS NULL OR p.id>$1) ORDER BY p.id LIMIT $2`,[cursor,limit+1])).rows;
    return {items:rows.slice(0,limit),nextCursor:rows.length>limit?rows[limit-1]!.id:null};
   });
  },
  async dependent(target:unknown,token:unknown){const personId=id(target);return reactivationTransaction(pool,sessions,token,[],[personId],true,async c=>{
   const p=(await c.query<{id:string;fullName:string;deactivationSequence:number}>(`SELECT p.id,p.full_name AS "fullName",d.deactivation_sequence AS "deactivationSequence" FROM dependent_profiles d JOIN people p ON p.id=d.person_id WHERE p.id=$1 AND p.status='inactive' AND d.independent_at IS NULL AND d.deactivation_sequence>0 FOR SHARE OF d`,[personId])).rows[0];if(!p)throw new AuthError('NOT_FOUND');
   const guardians=(await c.query<{accountId:string;fullName:string;eligible:boolean;acceptedInvitationId:string|null}>(`SELECT a.id AS "accountId",gp.full_name AS "fullName",(a.status='active' AND gp.status='active' AND a.confirmation_status IN ('verified','exempt') AND EXISTS(SELECT 1 FROM account_roles WHERE account_id=a.id AND role='customer')) AS eligible,(SELECT i.id FROM guardian_reactivation_invitations i JOIN accounts issuer ON issuer.id=i.issued_by_account_id JOIN people ip ON ip.id=issuer.person_id WHERE i.dependent_person_id=$1 AND i.deactivation_sequence=$2 AND i.profile_version=d.version AND i.guardian_account_id=a.id AND i.accepted_at IS NOT NULL AND i.superseded_at IS NULL AND i.recipient_version=a.session_version AND i.recipient_email=a.email AND issuer.status='active' AND ip.status='active' AND issuer.confirmation_status IN ('verified','exempt') AND issuer.session_version=i.issued_by_account_version AND EXISTS(SELECT 1 FROM account_roles WHERE account_id=issuer.id AND role IN ('administrator','manager')) ORDER BY i.accepted_at DESC LIMIT 1) AS "acceptedInvitationId" FROM dependent_prior_guardians prior JOIN dependent_guardians g ON g.id=prior.guardian_relationship_id JOIN accounts a ON a.id=g.guardian_account_id JOIN people gp ON gp.id=a.person_id JOIN dependent_profiles d ON d.person_id=prior.dependent_person_id WHERE prior.dependent_person_id=$1 AND prior.deactivation_sequence=$2 ORDER BY a.id LIMIT 100`,[personId,p.deactivationSequence])).rows;
   return {dependent:{id:p.id,fullName:p.fullName},deactivationSequence:p.deactivationSequence,guardians};
  });}
 };
}
