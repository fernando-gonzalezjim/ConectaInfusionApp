import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { ActionAcceptedResponse, PasswordResetInput, PasswordResetResponse } from '@conecta/contracts';
import { Button } from './button';
import { Input } from './input';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './dialog';

export interface RecoveryApi {
  requestRecovery(input: { email: string }, signal?: AbortSignal): Promise<ActionAcceptedResponse>;
  resetPassword(input: PasswordResetInput, signal?: AbortSignal): Promise<PasswordResetResponse>;
}
export type RecoveryKey = 'forgotPassword' | 'recoveryIntro' | 'recoveryAccepted' | 'sendRecovery' | 'sendingRequest'
  | 'email' | 'close' | 'resendHint' | 'authThrottled' | 'registrationUnavailable' | 'registrationInvalid'
  | 'newPassword' | 'confirmPassword' | 'passwordPolicy' | 'passwordMismatch' | 'resetPassword' | 'resettingPassword';
export type RecoveryText = (key: RecoveryKey) => string;
function code(error: unknown) { return error instanceof Error && 'code' in error ? error.code : null; }

export function RecoveryRequest({ api, t }: { api: RecoveryApi; t: RecoveryText }) {
  const id = useId(); const [open, setOpen] = useState(false); const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false); const [accepted, setAccepted] = useState(false); const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  function changeOpen(value: boolean) { request.current?.abort(); request.current = null; setOpen(value); setPending(false); setAccepted(false); setError(null); }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (request.current) return;
    const controller = new AbortController(); request.current = controller; setPending(true); setError(null);
    try { await api.requestRecovery({ email }, controller.signal); if (!controller.signal.aborted) setAccepted(true); }
    catch (failure) { if (!controller.signal.aborted) setError(t(code(failure) === 'THROTTLED' ? 'authThrottled' : code(failure) === 'INVALID_REQUEST' ? 'registrationInvalid' : 'registrationUnavailable')); }
    finally { if (request.current === controller) { request.current = null; if (!controller.signal.aborted) setPending(false); } }
  }
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button variant="outline" className="min-h-11 whitespace-normal">{t('forgotPassword')}</Button></DialogTrigger>
    <DialogContent closeLabel={t('close')} className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
      <DialogHeader><DialogTitle>{t('forgotPassword')}</DialogTitle><DialogDescription>{t('recoveryIntro')}</DialogDescription></DialogHeader>
      {accepted ? <div className="space-y-4"><p role="status">{t('recoveryAccepted')}</p><p className="text-sm text-muted-foreground">{t('resendHint')}</p><Button variant="outline" onClick={() => setAccepted(false)}>{t('sendRecovery')}</Button></div>
        : <form onSubmit={event => void submit(event)} className="space-y-4" aria-busy={pending}>
          <div><label htmlFor={id} className="mb-2 block text-sm font-medium">{t('email')}</label><Input id={id} autoFocus required type="email" maxLength={320} autoComplete="email" value={email} disabled={pending} onChange={e => setEmail(e.target.value)} /></div>
          <p className="text-sm text-muted-foreground">{t('resendHint')}</p>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="min-h-11 w-full" disabled={pending}>{t(pending ? 'sendingRequest' : 'sendRecovery')}</Button>
        </form>}
    </DialogContent>
  </Dialog>;
}

export function PasswordResetForm({ api, t, token, onCompleted, onInvalid, onRequest }: {
  api: RecoveryApi; t: RecoveryText; token: string; onCompleted(): void; onInvalid(): void; onRequest?(controller: AbortController): void;
}) {
  const id = useId(); const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null); const confirmInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { confirmInput.current?.setCustomValidity(confirmation && confirmation !== password ? t('passwordMismatch') : ''); }, [password, confirmation, t]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (request.current) return;
    const controller = new AbortController(); request.current = controller; onRequest?.(controller); setPending(true); setError(null);
    try { await api.resetPassword({ token, password }, controller.signal); if (!controller.signal.aborted) onCompleted(); }
    catch (failure) { if (!controller.signal.aborted) {
      if (code(failure) === 'INVALID_ACTION') onInvalid();
      else setError(t(code(failure) === 'THROTTLED' ? 'authThrottled' : code(failure) === 'INVALID_REQUEST' ? 'registrationInvalid' : 'registrationUnavailable'));
    } }
    finally { if (request.current === controller) { request.current = null; if (!controller.signal.aborted) { setPending(false); setPassword(''); setConfirmation(''); } } }
  }
  return <form onSubmit={event => void submit(event)} className="space-y-4" aria-busy={pending}>
    <div><label htmlFor={id+'-password'} className="mb-2 block text-sm font-medium">{t('newPassword')}</label><Input id={id+'-password'} required type="password" maxLength={256} autoComplete="new-password" value={password} disabled={pending} aria-describedby={id+'-policy'}
      onChange={e => { const value=e.target.value; setPassword(value); e.target.setCustomValidity(value && ([...value].length<15 || [...value].length>128) ? t('passwordPolicy') : ''); }} />
      <p id={id+'-policy'} className="mt-2 text-sm text-muted-foreground">{t('passwordPolicy')}</p></div>
    <div><label htmlFor={id+'-confirm'} className="mb-2 block text-sm font-medium">{t('confirmPassword')}</label><Input ref={confirmInput} id={id+'-confirm'} required type="password" maxLength={256} autoComplete="new-password" value={confirmation} disabled={pending} onChange={e => setConfirmation(e.target.value)} /></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" disabled={pending} className="min-h-11 w-full">{t(pending ? 'resettingPassword' : 'resetPassword')}</Button>
  </form>;
}
