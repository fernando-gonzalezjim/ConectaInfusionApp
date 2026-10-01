import type { Locale } from '@conecta/contracts';
const key = 'conecta.locale';
export function readLocale(storage?: Pick<Storage, 'getItem'>): Locale {
  try { return storage?.getItem(key) === 'en' ? 'en' : 'es-MX'; } catch { return 'es-MX'; }
}
export function saveLocale(locale: Locale, storage?: Pick<Storage, 'setItem'>) {
  try { storage?.setItem(key,locale); } catch { /* Language still works without storage. */ }
}
export function formatMoney(amountMinor: number, currency: string, locale: Locale) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'code' }).format(amountMinor / 100);
}
export function formatBusinessTime(instant: string, locale: Locale, timeZone: string) {
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone }).format(new Date(instant));
}
