import { useEffect, useState } from 'react';
import type { Locale, PublicSettings } from '@conecta/contracts';
import { createApiClient } from '@conecta/api-client';
import { useLocale } from '@conecta/i18n';
import { Button } from '@conecta/ui/components/button';
import { Alert, AlertDescription } from '@conecta/ui/components/alert';
const api = createApiClient();
export function App() {
  const { locale, setLocale, t } = useLocale();
  const [settings,setSettings] = useState<PublicSettings | null>(null);
  const [failed,setFailed] = useState(false);
  const [loading,setLoading] = useState(true);
  const [attempt,setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setFailed(false);
    api.getPublicSettings(controller.signal).then(setSettings)
      .catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  },[attempt]);
  return <div className="min-h-screen bg-muted">
    <a href="#content" className="sr-only focus:not-sr-only focus:block focus:p-3">{t('skip')}</a>
    <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6"><a href="/" className="text-xl font-semibold">{settings?.displayName ?? 'Conecta Infusion'}</a><label className="flex items-center gap-2 text-sm">{t('language')}<select aria-label={t('language')} value={locale} onChange={e => setLocale(e.target.value as Locale)} className="rounded-md border border-input bg-white p-2"><option value="es-MX">Español</option><option value="en">English</option></select></label></div></header>
    <main id="content" className="mx-auto max-w-6xl px-6 py-12"><p className="text-xs font-semibold tracking-[.16em] text-primary">{t('managementEyebrow')}</p><h1 className="my-4 text-4xl font-semibold tracking-tight">{t('managementTitle')}</h1><p className="max-w-xl text-muted-foreground">{t('managementIntro')}</p>
      <Alert className="my-8 bg-secondary"><AlertDescription>{t('staffLater')}</AlertDescription></Alert>
      {loading && <p role="status">{t('loading')}</p>}
      {failed && <Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center justify-between gap-4">{t('unavailable')}<Button variant="outline" onClick={() => setAttempt(a=>a+1)}>{t('retry')}</Button></AlertDescription></Alert>}
      {!loading && !failed && settings && <section aria-labelledby="details" className="rounded-2xl border bg-white p-6 md:p-8"><h2 id="details" className="mb-6 text-xl font-semibold">{t('details')}</h2><dl className="grid gap-6 sm:grid-cols-3">{[[t('business'),settings.displayName],[t('currency'),settings.currency],[t('timezone'),settings.timezone]].map(([label,value])=><div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-2 break-words font-medium">{value}</dd></div>)}</dl><h3 className="mb-3 mt-8 text-sm font-semibold">{t('areas')}</h3><div className="flex flex-wrap gap-3">{settings.units.map(unit=><span key={unit.code} className="rounded-full bg-lilac/40 px-4 py-2 text-sm">{unit.labels[locale]}</span>)}</div></section>}
    </main><footer className="mx-auto max-w-6xl px-6 py-6 text-sm text-muted-foreground">{t('footer')}</footer>
  </div>;
}
