import type { Pool, PoolClient } from 'pg';
import type { PublicSettings } from '@conecta/contracts';
import { validateSettings } from './validation.js';
import { appendSettingsAudit, type SettingsAudit } from './audit.js';

const selectSettings = `SELECT display_name AS "displayName", country, currency, timezone,
  default_locale AS "defaultLocale", supported_locales AS "supportedLocales", default_capacity AS "defaultCapacity"
  FROM business_settings WHERE id = 1`;

export async function readPublicSettings(db: Pool): Promise<PublicSettings> {
  const result = await db.query(selectSettings);
  const settings = validateSettings(result.rows[0]);
  const units = await db.query(`SELECT code, json_build_object('es-MX',label_es,'en',label_en) AS labels FROM business_units ORDER BY code DESC`);
  return { displayName: settings.displayName, currency: settings.currency, timezone: settings.timezone,
    defaultLocale: settings.defaultLocale, supportedLocales: settings.supportedLocales, units: units.rows };
}

// Caller owns BEGIN/COMMIT. Do not expose before Identity supplies authorization.
export async function updateSettingsInTransaction(client: PoolClient, input: unknown, context: Omit<SettingsAudit, 'before' | 'after'>) {
  const after = validateSettings(input);
  const current = await client.query(`${selectSettings} FOR UPDATE`);
  const before = validateSettings(current.rows[0]);
  await client.query(`UPDATE business_settings SET display_name=$1,country=$2,currency=$3,timezone=$4,
    default_locale=$5,supported_locales=$6,default_capacity=$7 WHERE id=1`,
    [after.displayName,after.country,after.currency,after.timezone,after.defaultLocale,after.supportedLocales,after.defaultCapacity]);
  await appendSettingsAudit(client, { ...context, before, after });
  return after;
}

export async function updateSettings(db: Pool, input: unknown, context: Omit<SettingsAudit, 'before' | 'after'>) {
  const client = await db.connect();
  try { await client.query('BEGIN'); const result = await updateSettingsInTransaction(client,input,context); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
