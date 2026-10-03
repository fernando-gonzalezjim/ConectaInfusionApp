import type { Pool } from 'pg';

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
