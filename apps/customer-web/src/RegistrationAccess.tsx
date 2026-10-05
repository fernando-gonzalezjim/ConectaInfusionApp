import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { createApiClient, ApiError } from '@conecta/api-client';
import { useLocale, useAccountLabels } from '@conecta/i18n';
import {GuardianInvitation} from '@conecta/ui/components/guardian-invitation';
import {FamilyInvitation} from '@conecta/ui/components/family-invitation';
import { Button } from '@conecta/ui/components/button';
import { Input } from '@conecta/ui/components/input';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@conecta/ui/components/dialog';

import { IdentityActionPage } from '@conecta/ui/components/identity-action-page';
const api = createApiClient();
export function RegistrationAccess({ resendOnly = false }: { resendOnly?: boolean }) {
  const { t, locale } = useLocale(); const id = useId();
  const [open, setOpen] = useState(false); const [resend, setResend] = useState(resendOnly);
  const [email, setEmail] = useState(''); const [name, setName] = useState(''); const [phone, setPhone] = useState('');
  const [password, setPassword] = useState(''); const [pending, setPending] = useState(false);
  const [accepted, setAccepted] = useState(false); const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null); const busy = useRef(false);
  useEffect(() => () => request.current?.abort(), []);
  function changeOpen(value: boolean) {
    request.current?.abort(); request.current = null; busy.current = false;
    setOpen(value); setPending(false); setPassword(''); setError(null); setAccepted(false); setResend(resendOnly);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy.current) return;
    busy.current = true; const controller = new AbortController(); request.current = controller;
    setPending(true); setError(null);
    try {
      await (resend ? api.resendConfirmation({ email }, controller.signal) : api.register({ fullName: name, email, password, phone: phone || null, preferredLocale: locale }, controller.signal));
      if (!controller.signal.aborted) { setAccepted(true); setPassword(''); }
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof ApiError && failure.code === 'THROTTLED' ? t('authThrottled')
        : failure instanceof ApiError && failure.code === 'INVALID_REQUEST' ? t('registrationInvalid') : t('registrationUnavailable'));
    } finally {
      if (request.current === controller) { busy.current = false; if (!controller.signal.aborted) { setPending(false); setPassword(''); } }
    }
  }
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button variant="outline" className="min-h-11">{t(resendOnly ? 'resendConfirmation' : 'createAccount')}</Button></DialogTrigger>
    <DialogContent closeLabel={t('close')} className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
      <DialogHeader><DialogTitle>{t(resend ? 'resendConfirmation' : 'createAccount')}</DialogTitle><DialogDescription>{t(resend ? 'resendIntro' : 'registerIntro')}</DialogDescription></DialogHeader>
      {accepted ? <div className="space-y-4"><p role="status">{t('confirmationPending')}</p><p className="text-sm text-muted-foreground">{t('resendHint')}</p>
        <Button variant="outline" onClick={() => { setAccepted(false); setResend(true); }}>{t('resendConfirmation')}</Button></div>
      : <form onSubmit={event => void submit(event)} className="space-y-4" aria-busy={pending}>
        {!resend && <div><label htmlFor={id+'-name'} className="mb-2 block text-sm font-medium">{t('fullName')}</label><Input id={id+'-name'} autoFocus required maxLength={120} autoComplete="name" value={name} disabled={pending} onChange={e => setName(e.target.value)} /></div>}
        <div><label htmlFor={id+'-email'} className="mb-2 block text-sm font-medium">{t('email')}</label><Input id={id+'-email'} autoFocus={resend} required type="email" maxLength={320} autoComplete="email" value={email} disabled={pending} onChange={e => setEmail(e.target.value)} /></div>
        {!resend && <><div><label htmlFor={id+'-phone'} className="mb-2 block text-sm font-medium">{t('phoneOptional')}</label><Input id={id+'-phone'} type="tel" maxLength={40} autoComplete="tel" value={phone} disabled={pending} onChange={e => setPhone(e.target.value)} /></div>
          <div><label htmlFor={id+'-password'} className="mb-2 block text-sm font-medium">{t('password')}</label><Input id={id+'-password'} required type="password" maxLength={256} autoComplete="new-password" value={password} disabled={pending} aria-describedby={id+'-policy'}
            onChange={e => { const value = e.target.value; setPassword(value); e.target.setCustomValidity(value && ([...value].length < 15 || [...value].length > 128) ? t('passwordPolicy') : ''); }} />
            <p id={id+'-policy'} className="mt-2 text-sm text-muted-foreground">{t('passwordPolicy')}</p></div></>}
        {resend && <p className="text-sm text-muted-foreground">{t('resendHint')}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={pending} className="min-h-11 w-full">{t(pending ? 'sendingRequest' : resend ? 'resendConfirmation' : 'createAccount')}</Button>
        {!resendOnly && !resend && <Button type="button" variant="ghost" disabled={pending} className="min-h-11 w-full" onClick={() => { setResend(true); setPassword(''); setError(null); }}>{t('resendConfirmation')}</Button>}
      </form>}
    </DialogContent>
  </Dialog>;
}

export function CustomerActionPage() {
  const { t, locale, setLocale } = useLocale();
  const labels=useAccountLabels();
  return <IdentityActionPage api={api} t={t} locale={locale} setLocale={setLocale} renderConfirmationResend={() => <RegistrationAccess resendOnly />}
    renderGuardianInvitation={(token,onCompleted,onInvalid)=><GuardianInvitation api={api} token={token} labels={labels} t={t} locale={locale} onCompleted={onCompleted} onInvalid={onInvalid}/>}
    renderFamilySuccessor={(token,onCompleted,onInvalid)=><FamilyInvitation purpose="responsibility" api={api} token={token} labels={labels} t={t} locale={locale} onCompleted={onCompleted} onInvalid={onInvalid} />}
    renderFamilyInvitation={(token,onCompleted,onInvalid)=><FamilyInvitation api={api} token={token} labels={labels} t={t} locale={locale} onCompleted={onCompleted} onInvalid={onInvalid} />} />;
}
