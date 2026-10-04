import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { ActionAcceptedResponse, CustomerInvitationInput, Locale, PublicAccount } from '@conecta/contracts';
import { Button } from './button';
import { Input } from './input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './dialog';

interface InvitationApi {
  inviteCustomer(input: CustomerInvitationInput, signal?: AbortSignal): Promise<ActionAcceptedResponse>;
  resendInvitation(input: { email: string }, signal?: AbortSignal): Promise<ActionAcceptedResponse>;
}
type InvitationKey = 'inviteCustomer' | 'invitationIntro' | 'invitationAccepted' | 'sendInvitation' | 'resendInvitation'
  | 'waiveConfirmation' | 'waiverHint' | 'waiverReason' | 'fullName' | 'email' | 'phoneOptional' | 'preferredLanguage'
  | 'close' | 'sendingRequest' | 'resendHint' | 'authThrottled' | 'authExpired' | 'authForbidden' | 'registrationInvalid' | 'registrationUnavailable';

export function CustomerInvitations({ api, account, locale, t }: {
  api: InvitationApi; account: PublicAccount; locale: Locale; t: (key: InvitationKey) => string;
}) {
  const id = useId(); const [open, setOpen] = useState(false); const [resend, setResend] = useState(false);
  const [email, setEmail] = useState(''); const [name, setName] = useState(''); const [phone, setPhone] = useState('');
  const [preferredLocale, setPreferredLocale] = useState(locale); const [waive, setWaive] = useState(false); const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false); const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<InvitationKey | null>(null); const [blocked, setBlocked] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const permitted = account.roles.some(role => ['administrator', 'manager', 'reception', 'cafe_staff', 'instructor'].includes(role));
  const privileged = account.roles.some(role => ['administrator', 'manager'].includes(role));
  function clear() { setEmail(''); setName(''); setPhone(''); setWaive(false); setReason(''); setPreferredLocale(locale); }
  function changeOpen(value: boolean) {
    request.current?.abort(); request.current = null; setOpen(value); setPending(false); setAccepted(false); setError(null); setResend(false); clear();
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (request.current || blocked) return;
    const controller = new AbortController(); request.current = controller; setPending(true); setError(null);
    try {
      if (resend) await api.resendInvitation({ email }, controller.signal);
      else await api.inviteCustomer({ email, fullName: name, phone: phone || null, preferredLocale,
        ...(privileged && waive ? { waiveConfirmation: true, reason } : {}) }, controller.signal);
      if (!controller.signal.aborted) { setAccepted(true); clear(); }
    } catch (failure) {
      if (!controller.signal.aborted) {
        const code = failure instanceof Error && 'code' in failure ? failure.code : null;
        setError(code === 'THROTTLED' ? 'authThrottled' : code === 'UNAUTHENTICATED' ? 'authExpired'
          : code === 'FORBIDDEN' ? 'authForbidden' : code === 'INVALID_REQUEST' ? 'registrationInvalid' : 'registrationUnavailable');
        if (code === 'UNAUTHENTICATED' || code === 'FORBIDDEN') { setBlocked(true); clear(); }
      }
    } finally { if (request.current === controller) { request.current = null; if (!controller.signal.aborted) setPending(false); } }
  }
  if (!permitted) return null;
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button className="min-h-11 whitespace-normal">{t('inviteCustomer')}</Button></DialogTrigger>
    <DialogContent closeLabel={t('close')} className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
      <DialogHeader><DialogTitle>{t(resend ? 'resendInvitation' : 'inviteCustomer')}</DialogTitle><DialogDescription>{t('invitationIntro')}</DialogDescription></DialogHeader>
      {accepted ? <p role="status">{t('invitationAccepted')}</p> : <form onSubmit={event => void submit(event)} className="space-y-4" aria-busy={pending}>
        <fieldset disabled={pending || blocked} className="space-y-4">
          <div><label htmlFor={id+'-email'} className="mb-2 block text-sm font-medium">{t('email')}</label><Input id={id+'-email'} autoFocus required type="email" maxLength={320} autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} /></div>
          {!resend && <>
            <div><label htmlFor={id+'-name'} className="mb-2 block text-sm font-medium">{t('fullName')}</label><Input id={id+'-name'} required maxLength={120} autoComplete="off" value={name} onChange={e => setName(e.target.value)} /></div>
            <div><label htmlFor={id+'-phone'} className="mb-2 block text-sm font-medium">{t('phoneOptional')}</label><Input id={id+'-phone'} type="tel" maxLength={40} autoComplete="off" value={phone} onChange={e => setPhone(e.target.value)} /></div>
            <div><label htmlFor={id+'-locale'} className="mb-2 block text-sm font-medium">{t('preferredLanguage')}</label><select id={id+'-locale'} className="w-full rounded-md border bg-background p-3" value={preferredLocale} onChange={e => setPreferredLocale(e.target.value as Locale)}><option value="es-MX">Español</option><option value="en">English</option></select></div>
            {privileged && <div className="space-y-3"><label className="flex items-start gap-3"><input type="checkbox" className="mt-1 size-5 shrink-0" checked={waive} onChange={e => { setWaive(e.target.checked); setReason(''); }} aria-describedby={id+'-hint'} /><span>{t('waiveConfirmation')}</span></label><p id={id+'-hint'} className="text-sm text-muted-foreground">{t('waiverHint')}</p>
              {waive && <div><label htmlFor={id+'-reason'} className="mb-2 block text-sm font-medium">{t('waiverReason')}</label><textarea id={id+'-reason'} required maxLength={500} rows={3} className="w-full rounded-md border bg-background p-3" value={reason} onChange={e => setReason(e.target.value)} /></div>}</div>}
          </>}
        </fieldset>
        <p className="text-sm text-muted-foreground">{t('resendHint')}</p>
        {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
        <Button type="submit" disabled={pending || blocked} className="min-h-11 w-full">{t(pending ? 'sendingRequest' : resend ? 'resendInvitation' : 'sendInvitation')}</Button>
      </form>}
      <Button variant="outline" disabled={pending || blocked} className="min-h-11 whitespace-normal" onClick={() => { setResend(value => !value); setAccepted(false); setError(null); clear(); }}>{t(resend ? 'inviteCustomer' : 'resendInvitation')}</Button>
    </DialogContent>
  </Dialog>;
}
