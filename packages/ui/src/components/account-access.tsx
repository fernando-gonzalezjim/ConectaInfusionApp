import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { LoginInput, LoginResponse, SessionResponse, PublicAccount, ApiErrorCode } from '@conecta/contracts';
import { Button } from './button';
import { SignInForm, type SignInLabels } from './sign-in-form';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './dialog';

interface AccountApi {
  getSession(signal?: AbortSignal): Promise<SessionResponse>;
  login(input: LoginInput, signal?: AbortSignal): Promise<LoginResponse>;
  logout(signal?: AbortSignal): Promise<void>;
  logoutAll(signal?: AbortSignal): Promise<void>;
}
export interface AccountLabels extends SignInLabels {
  account: string; signInIntro: string; accountIntro: string; fullName: string; close: string;
  signingOut: string; signOut: string; signOutAll: string;
  authInvalid: string; authThrottled: string; authExpired: string; authForbidden: string; authUnavailable: string;
}
function errorCode(error: unknown): ApiErrorCode {
  const codes: ApiErrorCode[] = ['INVALID_CREDENTIALS', 'INVALID_REQUEST', 'THROTTLED', 'UNAUTHENTICATED', 'NOT_FOUND', 'FORBIDDEN'];
  return error instanceof Error && 'code' in error && codes.includes(error.code as ApiErrorCode) ? error.code as ApiErrorCode : 'UNAVAILABLE';
}
export function AccountAccess({ api, labels, onAccountChange, renderProfile }: {
  api: AccountApi; labels: AccountLabels; onAccountChange?: (account: PublicAccount | null) => void;
  renderProfile?: (account:PublicAccount,onSaved:(account:PublicAccount)=>void,onPending:(pending:boolean)=>void,onAccessLost:()=>void)=>ReactNode;
}) {
  const t = (key: keyof AccountLabels) => labels[key];
  const [account, setAccount] = useState<PublicAccount | null>(null);
  const [open, setOpen] = useState(false); const [pending, setPending] = useState(false);
  const [profilePending,setProfilePending]=useState(false);
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const generation = useRef(0); const busy = useRef(false); const active = useRef(true);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    function refresh() {
      if (busy.current) return;
      request.current?.abort(); const controller = new AbortController(); request.current = controller;
      const current = ++generation.current;
      api.getSession(controller.signal).then(session => {
        if (!controller.signal.aborted && current === generation.current) { setAccount(session.account); onAccountChange?.(session.account); setError(null); }
      }).catch(failure => {
        if (controller.signal.aborted || current !== generation.current) return;
        const code = errorCode(failure);
        if (code === 'UNAUTHENTICATED' || code === 'NOT_FOUND') { setAccount(null); setError(null); }
        else setError(code);
        // A failed fresh read must remove any privileged UI derived by the parent.
        onAccountChange?.(null);
      });
    }
    function visible() { if (document.visibilityState === 'visible') refresh(); }
    refresh(); window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', visible);
    return () => { active.current = false; request.current?.abort(); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible); };
  }, [api, onAccountChange]);
  const errorText = error ? t(error === 'INVALID_CREDENTIALS' || error === 'INVALID_REQUEST' ? 'authInvalid'
    : error === 'THROTTLED' ? 'authThrottled' : error === 'UNAUTHENTICATED' ? 'authExpired'
    : error === 'FORBIDDEN' ? 'authForbidden' : 'authUnavailable') : null;
  async function mutate(operation: (signal: AbortSignal) => Promise<PublicAccount | null>) {
    if (busy.current) return;
    busy.current = true; ++generation.current; request.current?.abort();
    const controller = new AbortController(); request.current = controller; setPending(true); setError(null);
    try {
      const next = await operation(controller.signal);
      if (active.current && !controller.signal.aborted) { setAccount(next); onAccountChange?.(next); setOpen(false); }
    } catch (failure) {
      if (active.current && !controller.signal.aborted) {
        const code = errorCode(failure); setError(code);
        if (code === 'UNAUTHENTICATED') { setAccount(null); onAccountChange?.(null); }
      }
    } finally { busy.current = false; if (active.current) setPending(false); }
  }
  const signIn = (input: LoginInput) => mutate(async signal => (await api.login(input, signal)).account);
  const signOut = (all: boolean) => mutate(async signal => { await (all ? api.logoutAll(signal) : api.logout(signal)); return null; });
  return <Dialog open={open} onOpenChange={value => { if(profilePending)return;setOpen(value); if (!pending) setError(null); }}>
    <DialogTrigger asChild><Button variant="outline" className="min-h-11">{account ? t('account') : t('signIn')}</Button></DialogTrigger>
    <DialogContent closeLabel={t('close')} closeDisabled={profilePending} onEscapeKeyDown={event=>{if(profilePending)event.preventDefault();}} onInteractOutside={event=>{if(profilePending)event.preventDefault();}} className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
      <DialogHeader><DialogTitle>{account ? t('account') : t('signIn')}</DialogTitle><DialogDescription>{account ? t('accountIntro') : t('signInIntro')}</DialogDescription></DialogHeader>
      {account ? <div className="space-y-5">
        <dl className="space-y-2 break-words text-sm"><dt className="font-medium">{t('fullName')}</dt><dd>{account.fullName}</dd><dt className="font-medium">{t('email')}</dt><dd>{account.email}</dd></dl>
        {renderProfile?.(account,value=>{setAccount(value);onAccountChange?.(value);},setProfilePending,()=>{setAccount(null);onAccountChange?.(null);setOpen(false);})}
        {errorText && <p role="alert" className="text-sm text-destructive">{errorText}</p>}
        <div className="flex flex-col gap-3"><Button disabled={pending||profilePending} onClick={() => void signOut(false)} className="min-h-11">{pending ? t('signingOut') : t('signOut')}</Button>
          <Button variant="outline" disabled={pending||profilePending} onClick={() => void signOut(true)} className="min-h-11 whitespace-normal">{t('signOutAll')}</Button></div>
      </div> : <SignInForm pending={pending} error={errorText} onSubmit={signIn} labels={{ email: t('email'), password: t('password'), rememberMe: t('rememberMe'), rememberHint: t('rememberHint'), signIn: t('signIn'), signingIn: t('signingIn') }} />}
    </DialogContent>
  </Dialog>;
}
