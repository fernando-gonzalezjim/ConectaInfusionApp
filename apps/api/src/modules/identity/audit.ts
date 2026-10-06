import type { PoolClient } from 'pg';

export const identityAuditActions = ['account.created', 'account.profile_updated', 'account.roles_changed',
  'account.deactivated', 'account.reactivated', 'account.email_changed', 'account.email_change_requested',
  'account.confirmation_exempted', 'account.password_set','family.created','family.invitation_sent','family.member_joined','family.member_left','family.member_removed','family.closed','family.responsibility_offered','family.responsibility_accepted','family.responsibility_declined'] as const;
const roles = ['administrator', 'manager', 'reception', 'cafe_staff', 'instructor', 'customer'];
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
type Snapshot = Record<string, unknown>;
export interface IdentityAudit {
  actor: { id: string; type: 'staff' | 'customer' | 'system' };
  action: typeof identityAuditActions[number];
  targetType: 'account'|'family';
  targetId: string;
  before: Snapshot | null;
  after: Snapshot | null;
  reason: string;
  correlationId: string;
  correctionOf?: string;
}

function fail(): never { throw new Error('INVALID_IDENTITY_AUDIT'); }
function boundedString(value: unknown, limit: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
}
const familyFields=['name','version','membershipId','personId','responsibleMembershipId','memberCount','status','acceptedInvitationId','invitationId','invitationVersion'];
function sanitizedSnapshot(value: Snapshot | null,family=false): Snapshot | null {
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail();
  const result: Snapshot = {};
  for (const [field, entry] of Object.entries(value)) {
    if(family&&!familyFields.includes(field)||!family&&familyFields.includes(field)&&!['personId','status'].includes(field))fail();
    let valid = false;
    switch (field) {
      case 'fullName': valid = boundedString(entry, 120); break;
      case 'phone': valid = entry === null || (typeof entry === 'string' && entry.length <= 40); break;
      case 'preferredLocale': valid = entry === 'es-MX' || entry === 'en'; break;
      case 'email': valid = boundedString(entry, 320) && /^[^\s@]+@[^\s@]+$/.test(entry); break;
      case 'photoId': valid = entry === null || (typeof entry === 'string' && uuid.test(entry)); break;
      case 'personId': valid = typeof entry === 'string' && uuid.test(entry); break;
      case 'status': valid = typeof entry === 'string' && (family?['active','closed']:['pending', 'active', 'inactive']).includes(entry); break;
      case 'name': valid=boundedString(entry,120);break;
      case 'version': case 'memberCount':case 'invitationVersion':valid=typeof entry==='number'&&Number.isSafeInteger(entry)&&entry>=0&&entry<=2147483647;break;
      case 'membershipId':case 'acceptedInvitationId':case 'invitationId':valid=typeof entry==='string'&&uuid.test(entry);break;
      case 'responsibleMembershipId':valid=entry===null||typeof entry==='string'&&uuid.test(entry);break;
      case 'confirmationStatus': valid = typeof entry === 'string' && ['pending', 'verified', 'exempt'].includes(entry); break;
      case 'exemptionSource': valid = entry === null || entry === 'manual_bootstrap' || entry === 'management'; break;
      case 'roles': valid = Array.isArray(entry) && entry.length <= roles.length
        && entry.every(role => typeof role === 'string' && roles.includes(role)) && new Set(entry).size === entry.length; break;
      default: fail();
    }
    if (!valid) fail();
    result[field] = Array.isArray(entry) ? [...entry] : entry;
  }
  return result;
}

// Internal only: caller derives actor from trusted context and owns BEGIN/COMMIT/ROLLBACK.
// This writer cannot authorize a route, start a transaction or commit a domain mutation.
export async function appendIdentityAudit(client: PoolClient, event: IdentityAudit): Promise<void> {
  if (!event || !event.actor || !['staff', 'customer', 'system'].includes(event.actor.type)
    || !boundedString(event.actor.id, 120)
    || (event.actor.type !== 'system' && !uuid.test(event.actor.id))
    || !identityAuditActions.includes(event.action) || event.targetType !== (event.action.startsWith('family.')?'family':'account')
    || !uuid.test(event.targetId) || !uuid.test(event.correlationId)
    || (event.correctionOf !== undefined && !uuid.test(event.correctionOf))
    || !boundedString(event.reason, 500)) fail();
  const family=event.targetType==='family';
  const changes = { before: sanitizedSnapshot(event.before,family), after: sanitizedSnapshot(event.after,family) };
  await client.query(`INSERT INTO audit_events
    (actor_id,actor_type,action,target_type,target_id,changes,reason,correlation_id,correction_of)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [event.actor.id, event.actor.type, event.action,
    event.targetType, event.targetId, JSON.stringify(changes), event.reason,
    event.correlationId, event.correctionOf ?? null]);
}

// Stored history is untrusted on reads. Only writer-approved individual fields leave the API.
export function readIdentityAuditSnapshot(value:unknown,family=false):Record<string,import('@conecta/contracts').AuditValue>|null{
  if(value===null)return null;
  if(!value||typeof value!=='object'||Array.isArray(value))return {};
  const output:Record<string,import('@conecta/contracts').AuditValue>={};
  for(const [key,entry] of Object.entries(value))try{
    const safe=sanitizedSnapshot({[key]:entry},family);if(safe)output[key]=safe[key] as import('@conecta/contracts').AuditValue;
  }catch{ /* Unknown/malformed fields remain only in stored history. */ }
  return output;
}
