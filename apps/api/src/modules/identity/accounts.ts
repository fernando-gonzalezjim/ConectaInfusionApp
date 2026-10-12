import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { AccountProfile, AccountProfileInput, AccountListResponse, IdentityRole } from '@conecta/contracts';
import { AuthError, type SessionContext, type SessionService } from './sessions.js';
import { appendIdentityAudit } from './audit.js';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const roles: readonly IdentityRole[] = ['administrator', 'manager', 'reception', 'cafe_staff', 'instructor', 'customer'];
const profileColumns = `a.id,a.person_id AS "personId",a.email,p.full_name AS "fullName",p.phone,
  p.preferred_locale AS "preferredLocale",p.photo_id AS "photoId",a.status,p.status AS "profileStatus",
  a.confirmation_status AS "confirmationStatus",
  ARRAY(SELECT r.role FROM account_roles r WHERE r.account_id=a.id ORDER BY r.role) AS roles`;
function object(value: unknown, fields: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !fields.includes(key))) throw new AuthError('INVALID_REQUEST');
  return value as Record<string, unknown>;
}
function profileInput(value: unknown): AccountProfileInput {
  const input = object(value, ['fullName', 'phone', 'preferredLocale']);
  if (!Object.keys(input).length
    || (input.fullName !== undefined && (typeof input.fullName !== 'string' || !input.fullName.trim()
      || input.fullName.trim().length > 120 || /[\x00-\x1f\x7f]/.test(input.fullName)))
    || (input.phone !== undefined && input.phone !== null && (typeof input.phone !== 'string'
      || input.phone.length > 40 || /[\x00-\x1f\x7f]/.test(input.phone)))
    || (input.preferredLocale !== undefined && !['es-MX', 'en'].includes(input.preferredLocale as string))) throw new AuthError('INVALID_REQUEST');
  return { ...(input.fullName !== undefined ? { fullName: (input.fullName as string).trim() } : {}),
    ...(input.phone !== undefined ? { phone: input.phone as string | null } : {}),
    ...(input.preferredLocale !== undefined ? { preferredLocale: input.preferredLocale as 'es-MX' | 'en' } : {}) };
}

export function createAccountService(pool: Pool, sessions: SessionService, options: { now?: () => Date } = {}) {
  const clock = options.now ?? (() => new Date());
  async function transaction<T>(apply: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const result = await apply(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  async function authorize(client: PoolClient, context: SessionContext, targetId?: string) {
    // Deterministic account/person order also permits two managers to edit each other without a lock cycle.
    const accounts = (await client.query<{ id: string; person_id: string; status: string; confirmation_status: string; session_version: number }>(
      `SELECT id,person_id,status,confirmation_status,session_version FROM accounts WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
      [[...new Set([context.account.id, ...(targetId ? [targetId] : [])])]])).rows;
    const actor = accounts.find(account => account.id === context.account.id);
    if (!actor || actor.status !== 'active' || !['verified', 'exempt'].includes(actor.confirmation_status)
      || actor.session_version !== context.sessionVersion) throw new AuthError('UNAUTHENTICATED');
    const people = (await client.query<{ id: string; status: string }>('SELECT id,status FROM people WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',
      [accounts.map(account => account.person_id)])).rows;
    if (people.find(person => person.id === actor.person_id)?.status !== 'active') throw new AuthError('UNAUTHENTICATED');
    const session = (await client.query<{ expires_at: Date }>(`SELECT expires_at FROM identity_sessions WHERE id=$1 AND account_id=$2
      AND session_version=$3 AND revoked_at IS NULL FOR UPDATE`, [context.sessionId, actor.id, context.sessionVersion])).rows[0];
    const currentRoles = (await client.query<{ role: string }>('SELECT role FROM account_roles WHERE account_id=$1 FOR SHARE', [actor.id])).rows;
    if (!session || session.expires_at.getTime() <= clock().getTime()) throw new AuthError('UNAUTHENTICATED');
    const management = currentRoles.some(({ role }) => role === 'administrator' || role === 'manager');
    if ((!targetId || targetId !== actor.id) && !management) throw new AuthError('FORBIDDEN');
    if (targetId && !accounts.some(account => account.id === targetId)) throw new AuthError('NOT_FOUND');
    return currentRoles.map(({ role }) => role);
  }
  async function profile(client: PoolClient, id: string): Promise<AccountProfile> {
    const row = (await client.query<AccountProfile>(`SELECT ${profileColumns} FROM accounts a JOIN people p ON p.id=a.person_id WHERE a.id=$1`, [id])).rows[0];
    if (!row) throw new AuthError('NOT_FOUND');
    return row;
  }
  return {
    async withStaffRead<T>(token:unknown,read:(client:PoolClient,context:SessionContext)=>Promise<T>):Promise<T>{
      const context=await sessions.resolve(token,['administrator','manager','reception','cafe_staff','instructor']);
      return transaction(async client=>{
        const currentRoles=await authorize(client,context,context.account.id);
        if(!currentRoles.some(role=>role!=='customer'))throw new AuthError('FORBIDDEN');
        return read(client,{...context,account:{...context.account,roles:currentRoles as IdentityRole[]}});
      });
    },
    async withInstructorRead<T>(token:unknown,read:(client:PoolClient,context:SessionContext)=>Promise<T>):Promise<T>{
      const context=await sessions.resolve(token,['instructor']);
      return transaction(async client=>{
        const currentRoles=await authorize(client,context,context.account.id);
        if(!currentRoles.includes('instructor'))throw new AuthError('FORBIDDEN');
        return read(client,{...context,account:{...context.account,roles:currentRoles as IdentityRole[]}});
      });
    },
    async withManagementRead<T>(token:unknown,read:(client:PoolClient,context:SessionContext)=>Promise<T>,targetAccountId?:string):Promise<T>{
      const context=await sessions.resolve(token,['administrator','manager']);
      return transaction(async client=>{
        const currentRoles=await authorize(client,context,targetAccountId);
        if(!currentRoles.some(role=>role==='administrator'||role==='manager'))throw new AuthError('FORBIDDEN');
        return read(client,{...context,account:{...context.account,roles:currentRoles as IdentityRole[]}});
      });
    },
    async readAuthorized(target: unknown, token: unknown): Promise<AccountProfile> {
      const context = await sessions.resolve(token);
      if (typeof target !== 'string' || !uuid.test(target)) throw new AuthError('INVALID_REQUEST');
      return transaction(async client => { await authorize(client, context, target.toLowerCase()); return profile(client, target.toLowerCase()); });
    },
    async replacePhoto(target: unknown, photoId: string, token: unknown) {
      const context = await sessions.resolve(token);
      if (typeof target !== 'string' || !uuid.test(target) || !uuid.test(photoId)) throw new AuthError('INVALID_REQUEST');
      const targetId = target.toLowerCase();
      return transaction(async client => {
        const actorRoles = await authorize(client, context, targetId);
        const before = await profile(client, targetId);
        await client.query('UPDATE people SET photo_id=$2,updated_at=$3 WHERE id=$1', [before.personId, photoId, clock()]);
        await appendIdentityAudit(client, { actor: { id: context.account.id, type: actorRoles.some(role => role !== 'customer') ? 'staff' : 'customer' },
          action: 'account.profile_updated', targetType: 'account', targetId, before: {photoId:before.photoId}, after: {photoId},
          reason: targetId === context.account.id ? 'Own profile photo replaced' : 'Profile photo replaced by management', correlationId: randomUUID() });
        return {profile:await profile(client,targetId),previousPhotoId:before.photoId};
      });
    },
    async readOwn(token: unknown, id: string): Promise<AccountProfile> {
      const context = await sessions.resolve(token);
      if (id !== context.account.id) throw new AuthError('FORBIDDEN');
      return transaction(async client => { await authorize(client, context, id); return profile(client, id); });
    },
    async list(value: unknown, token: unknown): Promise<AccountListResponse> {
      const context = await sessions.resolve(token, ['administrator', 'manager']);
      const input = object(value, ['limit', 'cursor', 'role', 'status']);
      if ((input.limit !== undefined && (typeof input.limit !== 'string' || !/^[1-9][0-9]?$/.test(input.limit) || Number(input.limit) > 50))
        || (input.cursor !== undefined && (typeof input.cursor !== 'string' || !uuid.test(input.cursor)))
        || (input.role !== undefined && !roles.includes(input.role as IdentityRole))
        || (input.status !== undefined && !['pending', 'active', 'inactive'].includes(input.status as string))) throw new AuthError('INVALID_REQUEST');
      const limit = input.limit === undefined ? 25 : Number(input.limit);
      return transaction(async client => {
        await authorize(client, context);
        const result = await client.query<AccountProfile>(`SELECT ${profileColumns} FROM accounts a JOIN people p ON p.id=a.person_id
          WHERE ($1::uuid IS NULL OR a.id>$1) AND ($2::text IS NULL OR EXISTS(SELECT 1 FROM account_roles r WHERE r.account_id=a.id AND r.role=$2))
          AND ($3::text IS NULL OR a.status=$3) ORDER BY a.id LIMIT $4`, [input.cursor ?? null, input.role ?? null, input.status ?? null, limit + 1]);
        const accounts = result.rows.slice(0, limit);
        return { accounts, nextCursor: result.rows.length > limit ? accounts.at(-1)!.id : null };
      });
    },
    async update(target: unknown, value: unknown, token: unknown): Promise<AccountProfile> {
      const context = await sessions.resolve(token);
      if (typeof target !== 'string' || !uuid.test(target)) throw new AuthError('INVALID_REQUEST');
      const targetId = target.toLowerCase(); const input = profileInput(value);
      return transaction(async client => {
        const actorRoles = await authorize(client, context, targetId);
        const before = await profile(client, targetId);
        await client.query(`UPDATE people SET full_name=$2,phone=$3,preferred_locale=$4,updated_at=$5 WHERE id=$1`,
          [before.personId, input.fullName ?? before.fullName, Object.hasOwn(input, 'phone') ? input.phone : before.phone,
            input.preferredLocale ?? before.preferredLocale, clock()]);
        const after = await profile(client, targetId);
        const snapshot = (account: AccountProfile) => ({ fullName: account.fullName, phone: account.phone, preferredLocale: account.preferredLocale });
        await appendIdentityAudit(client, { actor: { id: context.account.id, type: actorRoles.some(role => role !== 'customer') ? 'staff' : 'customer' },
          action: 'account.profile_updated', targetType: 'account', targetId, before: snapshot(before), after: snapshot(after),
          reason: targetId === context.account.id ? 'Own personal profile updated' : 'Personal profile updated by management', correlationId: randomUUID() });
        return after;
      });
    },
  };
}

interface LegacyMember {
  id: string;
  personId: string | null;
  normalizedEmail: string;
  matchingAccountId: string | null;
  issues: string[];
  requiresReview: boolean;
}
interface LegacyInstructor { id: string; personId: string | null; requiresReview: boolean }

// Internal operator report only. Email similarity is never proof of ownership.
// No write/link/claim operation is exposed before trusted authorization and audit exist.
export async function readLegacyIdentityReconciliation(pool: Pool): Promise<{
  members: LegacyMember[]; instructors: LegacyInstructor[];
}> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const members = await client.query<{
      id: string; personId: string | null; normalizedEmail: string;
      matchingAccountId: string | null; accountPersonId: string | null; collision: boolean; validEmail: boolean;
    }>(`SELECT m.id, m.person_id AS "personId", lower(btrim(m.email)) AS "normalizedEmail",
      a.id AS "matchingAccountId", a.person_id AS "accountPersonId",
      count(*) OVER (PARTITION BY lower(btrim(m.email))) > 1 AS collision,
      length(lower(btrim(m.email))) BETWEEN 3 AND 320 AND
        lower(btrim(m.email)) ~ '^[^[:space:]@]+@[^[:space:]@]+$' AS "validEmail"
      FROM members m LEFT JOIN accounts a ON a.email = lower(btrim(m.email)) ORDER BY m.id`);
    const instructors = await client.query<{ id: string; personId: string | null }>(
      'SELECT id, person_id AS "personId" FROM instructors ORDER BY id');
    await client.query('COMMIT');
    return {
      members: members.rows.map(row => {
        const issues: string[] = [];
        if (!row.validEmail) issues.push('invalid_normalized_email');
        if (row.collision) issues.push('normalized_email_collision');
        if (row.matchingAccountId && !row.personId) issues.push('existing_account_requires_ownership_review');
        if (row.accountPersonId && row.personId && row.accountPersonId !== row.personId) issues.push('linked_person_conflicts_with_matching_account');
        return { id: row.id, personId: row.personId, normalizedEmail: row.normalizedEmail,
          matchingAccountId: row.matchingAccountId, issues, requiresReview: row.personId === null || issues.length > 0 };
      }),
      instructors: instructors.rows.map(row => ({ ...row, requiresReview: row.personId === null })),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
