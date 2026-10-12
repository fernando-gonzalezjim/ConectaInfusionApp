import type {PoolClient} from 'pg';
import {createLifecycleGuard,requiredLifecycleDomains,type LifecycleRequest,type LifecycleCoordinator,type LifecycleBlock} from '../modules/identity/lifecycle.js';

const foundationTables=['members','instructors','class_sessions','bookings','products','sales','sale_items','business_units','business_settings','audit_events'];
const identityTables=['people','accounts','account_roles','identity_sessions','identity_action_tokens','identity_throttles','identity_email_outbox','families','family_memberships','family_invitations','family_successor_offers','dependent_profiles','dependent_guardians','dependent_deactivations','dependent_prior_guardians','saved_child_details','guardian_invitations','guardian_consent_exceptions','guardian_reactivation_invitations','identity_lifecycle_operations','flyway_schema_history'];
// Known additive V15 relations are schema awareness, not proof that a catalog,
// booking or payroll coordinator exists. Missing required domains still block.
const knownCatalogRelations=['studio_disciplines','studio_classes','studio_instructor_profiles','studio_instructor_disciplines','studio_instructor_photos','studio_legacy_session_reconciliation'];
// Conservative default: even an empty Foundation database lacks credit/payroll
// coordinators. No absent table is interpreted as proof of no obligation.
export function createIdentityLifecycleComposition(coordinators:readonly LifecycleCoordinator[]=[]){
  const tables=coordinators.flatMap(c=>c.tables);
  if(tables.some(t=>typeof t!=='string'||!/^[a-z][a-z0-9_]{0,62}$/.test(t)||foundationTables.includes(t)||identityTables.includes(t)))throw new Error('INVALID_LIFECYCLE_TABLE_DECLARATION');
  const allowed=new Set([...foundationTables,...identityTables,...knownCatalogRelations,...tables]);
  async function inspect(client:PoolClient,request:Readonly<LifecycleRequest>):Promise<LifecycleBlock[]>{
    const present=(await client.query<{tablename:string}>("SELECT c.relname AS tablename FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')")).rows.map(r=>r.tablename);
    if([...foundationTables,...identityTables,...tables].some(t=>!present.includes(t))||present.some(t=>!allowed.has(t)))return ['UNKNOWN_SCHEMA'];
    // Serialize legacy inspections that may become writes, avoiding concurrent
    // SHARE-to-ROW-EXCLUSIVE lock upgrades. Future adapters use this same client
    // and acquire no account/person locks after this domain boundary.
    await client.query('LOCK TABLE members,instructors,class_sessions,bookings,sales,sale_items IN SHARE ROW EXCLUSIVE MODE');
    const legacy=(await client.query<{booking:boolean;teaching:boolean}>(`SELECT
      (EXISTS(SELECT 1 FROM members m WHERE m.person_id=ANY($1::uuid[])
        OR lower(btrim(m.email)) IN(SELECT email FROM accounts WHERE person_id=ANY($1::uuid[])))
      OR EXISTS(SELECT 1 FROM bookings b JOIN members m ON m.id=b.member_id
        WHERE b.attendee_person_id=ANY($1::uuid[]) OR m.person_id=ANY($1::uuid[])
        OR b.acting_account_id IN (SELECT id FROM accounts WHERE person_id=ANY($1::uuid[]))
        OR lower(btrim(m.email)) IN (SELECT email FROM accounts WHERE person_id=ANY($1::uuid[]))
        OR (m.person_id IS NULL AND b.attendee_person_id IS NULL))) AS booking,
      EXISTS(SELECT 1 FROM instructors i LEFT JOIN class_sessions s ON s.instructor_id=i.id
        WHERE i.person_id=ANY($1::uuid[]) OR i.person_id IS NULL) AS teaching`,[request.personIds])).rows[0];
    const relevant=requiredLifecycleDomains(request);
    if(legacy?.booking&&relevant.includes('credits-bookings')&&!coordinators.find(c=>c.domain==='credits-bookings')?.handlesLegacy
      ||legacy?.teaching&&relevant.includes('studio-catalog')&&!coordinators.find(c=>c.domain==='studio-catalog')?.handlesLegacy
      ||legacy?.teaching&&relevant.includes('instructor-payroll')&&!coordinators.find(c=>c.domain==='instructor-payroll')?.handlesLegacy)return ['LEGACY_OBLIGATIONS'];
    return [];
  }
  return createLifecycleGuard(coordinators,inspect);
}
