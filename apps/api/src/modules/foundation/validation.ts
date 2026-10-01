import type { Locale } from '@conecta/contracts';
export interface Settings {
  displayName: string; country: 'MX'; currency: 'MXN'; timezone: string;
  defaultLocale: Locale; supportedLocales: Locale[]; defaultCapacity: number;
}
export function validateSettings(input: unknown): Settings {
  const fail = (): never => { throw new Error('INVALID_SETTINGS'); };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail();
  const x = input as Record<string, unknown>;
  const allowed = ['displayName','country','currency','timezone','defaultLocale','supportedLocales','defaultCapacity'];
  if (Object.keys(x).some(key => !allowed.includes(key))) return fail();
  if (typeof x.displayName !== 'string' || !x.displayName.trim() || x.displayName.trim().length > 120) return fail();
  if (x.country !== 'MX' || x.currency !== 'MXN' || !['es-MX','en'].includes(String(x.defaultLocale))) return fail();
  if (JSON.stringify(x.supportedLocales) !== JSON.stringify(['es-MX','en'])) return fail();
  if (typeof x.defaultCapacity !== 'number' || !Number.isInteger(x.defaultCapacity) || x.defaultCapacity < 1 || x.defaultCapacity > 2147483647) return fail();
  if (typeof x.timezone !== 'string') return fail();
  try { new Intl.DateTimeFormat('en', { timeZone: x.timezone }); } catch { return fail(); }
  return { displayName: x.displayName.trim(), country: 'MX', currency: 'MXN', timezone: x.timezone,
    defaultLocale: x.defaultLocale as Locale, supportedLocales: ['es-MX','en'], defaultCapacity: x.defaultCapacity };
}
