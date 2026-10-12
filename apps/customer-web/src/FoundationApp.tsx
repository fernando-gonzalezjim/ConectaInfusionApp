import { useEffect, useState } from 'react';
import type { PublicSettings, StudioOverview, Locale } from '@conecta/contracts';
import { createApiClient } from '@conecta/api-client';
import { useLocale, formatBusinessTime, formatMoney } from '@conecta/i18n';
import { Button } from '@conecta/ui/components/button';
import { Input } from '@conecta/ui/components/input';
import { Alert, AlertDescription } from '@conecta/ui/components/alert';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogHeader } from '@conecta/ui/components/dialog';
import { CustomerAccess } from './CustomerAccess';
import {PublicCatalog} from './studio/catalog';

const api = createApiClient();
export function FoundationApp() {
  const { locale, setLocale, t } = useLocale();
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [overview, setOverview] = useState<StudioOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setFailed(false);
    Promise.all([api.getPublicSettings(controller.signal),api.getStudioOverview(controller.signal)])
      .then(([nextSettings,nextOverview]) => { setSettings(nextSettings); setOverview(nextOverview); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);
  const classes = overview?.classes.filter(item => `${item.name} ${item.instructor}`.toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale))) ?? [];
  return <div className="min-h-screen bg-background">
    <a href="#content" className="sr-only focus:not-sr-only focus:block focus:p-3">{t('skip')}</a>
    <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-b px-6 py-6">
      <a href="/" className="text-xl font-semibold tracking-tight">{settings?.displayName ?? 'Conecta Infusion'}</a>
      <label className="flex items-center gap-2 text-sm">{t('language')}<select aria-label={t('language')} value={locale} onChange={e => setLocale(e.target.value as Locale)} className="rounded-md border border-input bg-white p-2"><option value="es-MX">Español</option><option value="en">English</option></select></label>
      <CustomerAccess />
    </header>
    <main id="content" className="mx-auto max-w-6xl px-6 py-10 md:py-16">
      <section className="relative overflow-hidden rounded-3xl bg-secondary px-7 py-12 md:px-12">
        <div aria-hidden="true" className="absolute -right-8 -top-12 h-48 w-48 rounded-full bg-peach/60" />
        <div className="relative max-w-2xl"><p className="text-xs font-semibold tracking-[.18em]">{t('customerEyebrow')}</p><h1 className="my-5 text-4xl font-semibold leading-tight tracking-tight md:text-6xl">{t('customerTitle')}</h1><p className="text-lg text-muted-foreground">{t('customerIntro')}</p></div>
      </section>
      <div className="my-8 flex flex-wrap items-center justify-between gap-4"><p className="text-sm text-muted-foreground">{t('bookingLater')}</p>
        {settings && <Dialog><DialogTrigger asChild><Button variant="outline">{t('details')}</Button></DialogTrigger><DialogContent closeLabel={t('close')}><DialogHeader><DialogTitle>{t('details')}</DialogTitle><DialogDescription>{t('detailsDescription')}</DialogDescription></DialogHeader><dl className="space-y-3 text-sm"><dt className="font-semibold">{t('timezone')}</dt><dd>{settings.timezone}</dd><dt className="font-semibold">{t('currency')}</dt><dd>{settings.currency}</dd></dl></DialogContent></Dialog>}
      </div>
      {loading && <p role="status" className="my-5">{t('loading')}</p>}
      {failed && <Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center justify-between gap-4">{t('unavailable')}<Button variant="outline" onClick={() => setRetry(value => value+1)}>{t('retry')}</Button></AlertDescription></Alert>}
      <PublicCatalog api={api} t={t} locale={locale}/>
      <div className="grid gap-10 md:grid-cols-2">
        <section aria-labelledby="schedule"><h2 id="schedule" className="mb-5 text-2xl font-semibold">{t('schedule')}</h2>
          <label htmlFor="class-search" className="mb-2 block text-sm font-medium">{t('search')}</label><Input id="class-search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('searchPlaceholder')} />
          {!loading && !failed && settings && overview && <div className="mt-5">{classes.length === 0 && <p className="rounded-xl bg-muted p-5 text-muted-foreground">{overview.classes.length ? t('noMatches') : t('noClasses')}</p>}{classes.map(item => <article key={item.id} className="border-b py-5"><div className="flex flex-wrap justify-between gap-3"><h3 className="font-semibold">{item.name}</h3><span className="rounded-full bg-leaf/40 px-3 py-1 text-xs">{item.booked >= item.capacity ? t('full') : `${item.capacity-item.booked} ${t('spots')}`}</span></div><p className="mt-2 text-sm text-muted-foreground">{item.instructor} · {item.durationMinutes} {t('minutes')}</p><p className="mt-1 text-sm">{formatBusinessTime(item.startsAt,locale,settings.timezone)}</p></article>)}</div>}
        </section>
        <section aria-labelledby="menu"><h2 id="menu" className="mb-5 text-2xl font-semibold">{t('menu')}</h2>{!loading && !failed && overview && <>{overview.products.length === 0 && <p className="rounded-xl bg-muted p-5 text-muted-foreground">{t('noProducts')}</p>}{overview.products.map(item => <article key={item.id} className="flex items-center justify-between gap-3 border-b py-5"><div><h3 className="font-semibold">{item.name}</h3><p className="mt-1 text-sm text-muted-foreground">{t(item.category)}</p></div><span className="whitespace-nowrap text-sm font-semibold">{formatMoney(item.priceMinor,item.currency,locale)}</span></article>)}</>}</section>
      </div>
    </main><footer className="mx-auto max-w-6xl border-t px-6 py-6 text-sm text-muted-foreground">{t('footer')}</footer>
  </div>;
}
