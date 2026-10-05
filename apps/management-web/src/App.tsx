import { useCallback, useEffect, useState } from 'react';
import type { Locale, PublicSettings, PublicAccount, ManagementAccessResponse } from '@conecta/contracts';
import { createApiClient } from '@conecta/api-client';
import { useLocale, useAccountLabels } from '@conecta/i18n';
import { AccountAccess } from '@conecta/ui/components/account-access';
import { RecoveryRequest } from '@conecta/ui/components/password-recovery';
import { CustomerInvitations } from '@conecta/ui/components/customer-invitations';
import { Button } from '@conecta/ui/components/button';
import { Alert, AlertDescription } from '@conecta/ui/components/alert';
import { AccountAdministration } from './components/account-administration';
import { SelfProfile } from '@conecta/ui/components/self-profile';
import {OperationalAudit} from './components/operational-audit';
const api = createApiClient();
export function App() {
  const { locale, setLocale, t } = useLocale();
  const [settings,setSettings] = useState<PublicSettings | null>(null);
  const [failed,setFailed] = useState(false);
  const [loading,setLoading] = useState(true);
  const [attempt,setAttempt] = useState(0);
  const [account,setAccount] = useState<PublicAccount | null>(null);
  const [access,setAccess] = useState<ManagementAccessResponse | null>(null);
  const [accessState,setAccessState] = useState<'signed-out' | 'loading' | 'allowed' | 'denied' | 'unavailable'>('signed-out');
  const [accessAttempt,setAccessAttempt] = useState(0);
  const [accountEpoch,setAccountEpoch] = useState(0);
  const [accessNotice,setAccessNotice] = useState<'authExpired'|'managementDenied'|null>(null);
  const accessLost=useCallback((code:'UNAUTHENTICATED'|'FORBIDDEN')=>{
    setAccess(null);setAccount(null);setAccessNotice(code==='UNAUTHENTICATED'?'authExpired':'managementDenied');
    setAccountEpoch(value=>value+1);setAccessState('signed-out');
  },[]);
  const accountLabels = useAccountLabels();
  useEffect(() => {
    setAccess(null);
    if (!account) { setAccessState('signed-out'); return; }
    const controller = new AbortController(); setAccessState('loading');
    api.getManagementAccess(controller.signal).then(result => {
      if (!controller.signal.aborted) { setAccess(result); setAccessState('allowed'); }
    }).catch(error => {
      if (!controller.signal.aborted) setAccessState(error.code === 'FORBIDDEN' ? 'denied' : error.code === 'UNAUTHENTICATED' ? 'signed-out' : 'unavailable');
    });
    return () => controller.abort();
  }, [account, accessAttempt]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setFailed(false);
    api.getPublicSettings(controller.signal).then(setSettings)
      .catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  },[attempt]);
  return <div className="min-h-screen bg-muted">
    <a href="#content" className="sr-only focus:not-sr-only focus:block focus:p-3">{t('skip')}</a>
    <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6"><a href="/" className="text-xl font-semibold">{settings?.displayName ?? 'Conecta Infusion'}</a><label className="flex items-center gap-2 text-sm">{t('language')}<select aria-label={t('language')} value={locale} onChange={e => setLocale(e.target.value as Locale)} className="rounded-md border border-input bg-white p-2"><option value="es-MX">Español</option><option value="en">English</option></select></label><div className="flex flex-wrap gap-3"><AccountAccess key={accountEpoch} api={api} labels={accountLabels} onAccountChange={setAccount}
      renderProfile={(value,onSaved,onPending,onAccessLost)=><SelfProfile api={api} account={value} t={t} onSaved={onSaved} onPending={onPending} onAccessLost={onAccessLost} />} />{!account && <RecoveryRequest api={api} t={t} />}</div></div></header>
    <main id="content" className="mx-auto max-w-6xl px-6 py-12"><p className="text-xs font-semibold tracking-[.16em] text-primary">{t('managementEyebrow')}</p><h1 className="my-4 text-4xl font-semibold tracking-tight">{t('managementTitle')}</h1><p className="max-w-xl text-muted-foreground">{t('managementIntro')}</p>
      <div className="my-8">
        {accessNotice&&!account&&<p role="alert" className="mb-4 text-sm text-destructive">{t(accessNotice)}</p>}
        {account && <div className="mb-6"><CustomerInvitations key={account.id+account.roles.join(',')} api={api} account={account} locale={locale} t={t} /></div>}
        {accessState === 'signed-out' && <p className="text-sm text-muted-foreground">{t('managementSignedOut')}</p>}
        {accessState === 'loading' && <p role="status">{t('managementAccessLoading')}</p>}
        {accessState === 'denied' && <Alert><AlertDescription>{t('managementDenied')}</AlertDescription></Alert>}
        {accessState === 'unavailable' && <Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center justify-between gap-3">{t('managementAccessUnavailable')}<Button variant="outline" onClick={() => setAccessAttempt(value => value+1)}>{t('retry')}</Button></AlertDescription></Alert>}
        {accessState === 'allowed' && account && access?.account.id === account.id && access.capabilities.administerIdentity === true && <>
          <AccountAdministration key={account.id} api={api} actorId={account.id} t={t} onAccessLost={accessLost} />
          <OperationalAudit key={'audit-'+account.id} api={api} t={t} locale={locale} timezone={settings?.timezone??'America/Mexico_City'} onAccessLost={accessLost} />
        </>}
      </div>
      {loading && <p role="status">{t('loading')}</p>}
      {failed && <Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center justify-between gap-4">{t('unavailable')}<Button variant="outline" onClick={() => setAttempt(a=>a+1)}>{t('retry')}</Button></AlertDescription></Alert>}
      {!loading && !failed && settings && <section aria-labelledby="details" className="rounded-2xl border bg-white p-6 md:p-8"><h2 id="details" className="mb-6 text-xl font-semibold">{t('details')}</h2><dl className="grid gap-6 sm:grid-cols-3">{[[t('business'),settings.displayName],[t('currency'),settings.currency],[t('timezone'),settings.timezone]].map(([label,value])=><div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-2 break-words font-medium">{value}</dd></div>)}</dl><h3 className="mb-3 mt-8 text-sm font-semibold">{t('areas')}</h3><div className="flex flex-wrap gap-3">{settings.units.map(unit=><span key={unit.code} className="rounded-full bg-lilac/40 px-4 py-2 text-sm">{unit.labels[locale]}</span>)}</div></section>}
    </main><footer className="mx-auto max-w-6xl px-6 py-6 text-sm text-muted-foreground">{t('footer')}</footer>
  </div>;
}
