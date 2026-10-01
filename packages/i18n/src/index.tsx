import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Locale } from '@conecta/contracts';
import { readLocale, saveLocale } from './format';
import { es, en, type MessageKey } from './messages';
export { formatMoney, formatBusinessTime } from './format';

interface LanguageContext { locale: Locale; setLocale: (locale: Locale) => void; t: (key: MessageKey) => string }
const Context = createContext<LanguageContext | null>(null);
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => { try { return readLocale(window.localStorage); } catch { return 'es-MX'; } });
  useEffect(() => {
    document.documentElement.lang = locale;
    try { saveLocale(locale,window.localStorage); } catch { /* Storage access may be blocked. */ }
  }, [locale]);
  return <Context.Provider value={{ locale, setLocale, t: key => (locale === 'es-MX' ? es : en)[key] }}>{children}</Context.Provider>;
}
export function useLocale() {
  const value = useContext(Context);
  if (!value) throw new Error('LocaleProvider is required');
  return value;
}
