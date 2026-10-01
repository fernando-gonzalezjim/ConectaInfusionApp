import type { PoolClient } from 'pg';
import { validateSettings, type Settings } from './validation.js';
export interface TrustedActor { id: string; type: 'staff' | 'system' }
export interface SettingsAudit {
  actor: TrustedActor; before: Settings; after: Settings; reason: string;
  correlationId: string; correctionOf?: string;
}
// Internal-only writer. Identity must provide actor context; HTTP bodies never do.
export async function appendSettingsAudit(client: PoolClient, event: SettingsAudit) {
  if (!event.actor.id.trim() || !['staff','system'].includes(event.actor.type) || !event.reason.trim()) throw new Error('INVALID_AUDIT_EVENT');
  const changes = { before: validateSettings(event.before), after: validateSettings(event.after) };
  await client.query(`INSERT INTO audit_events
    (actor_id, actor_type, action, target_type, target_id, changes, reason, correlation_id, correction_of)
    VALUES ($1,$2,'settings.updated','business_settings','1',$3,$4,$5,$6)`,
    [event.actor.id, event.actor.type, JSON.stringify(changes), event.reason, event.correlationId, event.correctionOf ?? null]);
}
