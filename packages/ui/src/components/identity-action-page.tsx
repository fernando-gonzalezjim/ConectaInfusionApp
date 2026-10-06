import {DependentTransitionConfirmation,type TransitionApi,type TransitionKey} from './dependent-transition';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Locale, EmailConfirmedResponse, EmailChangedResponse, PasswordResetInput, PasswordSetupResponse } from '@conecta/contracts';
import { Button } from './button';
import { RecoveryRequest, PasswordResetForm, type RecoveryApi, type RecoveryKey } from './password-recovery';

type ActionKey = 'renewalTitle'|'renewalAccepted'| TransitionKey | RecoveryKey | 'language' | 'confirmEmail' | 'confirmIntro' | 'confirmingEmail' | 'emailConfirmed' | 'confirmationInvalid' | 'unsupportedAction' | 'returnHome' | 'signIn' | 'resetIntro' | 'resetComplete' | 'resetInvalid' | 'setupPassword' | 'settingPassword' | 'setupIntro' | 'setupComplete' | 'setupInvalid' | 'confirmNewEmail' | 'emailChanged' | 'emailChangeConfirmIntro' | 'familyInvitationTitle' | 'familyJoined' | 'familyInvalid' | 'successorTitle' | 'successorAccepted' | 'successorDeclined' | 'guardianTitle' | 'guardianAccepted' | 'guardianInvalid';
interface ActionApi extends RecoveryApi, TransitionApi {
  confirmEmail(input: { token: string }, signal?: AbortSignal): Promise<EmailConfirmedResponse>;
  setupPassword(input: PasswordResetInput, signal?: AbortSignal): Promise<PasswordSetupResponse>;
  confirmEmailChange(input: { token: string }, signal?: AbortSignal): Promise<EmailChangedResponse>;
}
// Capture once before React mounts (including StrictMode); never persist a token or leave it in history.
export const isActionPage = window.location.pathname === '/auth/action';
function readAction() {
  if (!isActionPage) return { token: null, supported: false, purpose: null as string | null };
  const params = new URLSearchParams(window.location.hash.slice(1));
  window.history.replaceState(null, '', window.location.pathname);
  const purpose = params.getAll('purpose').length === 1 ? params.get('purpose') : null;
  const supported = purpose === 'email_confirmation' || purpose === 'password_reset' || purpose === 'password_setup' || purpose === 'email_change' || purpose === 'family_invitation' || purpose === 'family_successor' || purpose === 'guardian_invitation' || purpose === 'dependent_transition' || purpose === 'guardian_reactivation';
  const token = params.getAll('token').length === 1 ? params.get('token') : null;
  return { supported, purpose, token: supported && token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null };
}
const incomingAction = readAction();
export function IdentityActionPage({ api, t, locale, setLocale, renderConfirmationResend, renderFamilyInvitation, renderFamilySuccessor, renderGuardianInvitation, renderGuardianReactivation }: {
  api: ActionApi; t: (key: ActionKey) => string; locale: Locale; setLocale(locale: Locale): void; renderConfirmationResend?: () => ReactNode;
  renderGuardianReactivation?:(token:string,onCompleted:()=>void,onInvalid:()=>void)=>ReactNode;
  renderGuardianInvitation?:(token:string,onCompleted:()=>void,onInvalid:()=>void)=>ReactNode;
  renderFamilyInvitation?:(token:string,onCompleted:()=>void,onInvalid:()=>void)=>ReactNode;
  renderFamilySuccessor?:(token:string,onCompleted:(decision?:'declined')=>void,onInvalid:()=>void)=>ReactNode;
}) {
  const token = useRef(incomingAction.token); const request = useRef<AbortController | null>(null); const busy = useRef(false);
  const [pending, setPending] = useState(false); const [confirmed, setConfirmed] = useState(false);
  const [invalid, setInvalid] = useState(!incomingAction.token); const [error, setError] = useState(false);
  const [supported, setSupported] = useState(incomingAction.supported);
  const [purpose, setPurpose] = useState(incomingAction.purpose);
  const resetting = purpose === 'password_reset';
  const settingUp = purpose === 'password_setup';
  const changingEmail = purpose === 'email_change';
  const transitioning=purpose==='dependent_transition';
  const guardianRenewal=purpose==='guardian_reactivation';
  const guardianInvitation=purpose==='guardian_invitation'||guardianRenewal;
  const familyInvitation = purpose === 'family_invitation' || purpose === 'family_successor' || guardianInvitation;
  const successor=purpose==='family_successor';
  const [declined,setDeclined]=useState(false);
  const [linkVersion, setLinkVersion] = useState(0);
  const generation = useRef(0); const currentGeneration = generation.current;
  useEffect(() => {
    incomingAction.token = null;
    function changed() {
      const next = readAction(); ++generation.current; request.current?.abort(); request.current = null; busy.current = false;
      token.current = next.token; setPurpose(next.purpose); setSupported(next.supported); setInvalid(!next.token);
      setConfirmed(false); setPending(false); setError(false);setDeclined(false);
      setLinkVersion(value => value+1);
    }
    window.addEventListener('hashchange', changed);
    return () => { request.current?.abort(); window.removeEventListener('hashchange', changed); };
  }, []);
  async function confirm() {
    if (busy.current || !token.current) return; busy.current = true;
    const controller = new AbortController(); request.current = controller; setPending(true); setError(false);
    try {
      await (changingEmail ? api.confirmEmailChange : api.confirmEmail)({ token: token.current }, controller.signal);
      if (!controller.signal.aborted) { token.current = null; setConfirmed(true); }
    } catch (failure) {
      if (!controller.signal.aborted) {
        if (failure instanceof Error && 'code' in failure && failure.code === 'INVALID_ACTION') { token.current = null; setInvalid(true); }
        else setError(true);
      }
    } finally { if (request.current === controller) { busy.current = false; if (!controller.signal.aborted) setPending(false); } }
  }
  return <div className="min-h-screen bg-background px-6 py-8">
    <header className="mx-auto flex max-w-xl flex-wrap items-center justify-between gap-4"><a href="/" className="text-xl font-semibold">Conecta Infusion</a>
      <label className="text-sm">{t('language')}<select aria-label={t('language')} className="ml-2 rounded-md border bg-background p-2" value={locale} onChange={e => setLocale(e.target.value as 'en' | 'es-MX')}><option value="es-MX">Español</option><option value="en">English</option></select></label></header>
    <main className="mx-auto mt-12 max-w-xl space-y-6 rounded-2xl border bg-card p-6 md:p-10" aria-busy={pending}>
      <h1 className="text-3xl font-semibold">{t(transitioning?'transitionTitle':guardianInvitation?guardianRenewal?'renewalTitle':'guardianTitle':successor ? 'successorTitle' : familyInvitation ? 'familyInvitationTitle' : settingUp ? 'setupPassword' : resetting ? 'resetPassword' : changingEmail ? 'confirmNewEmail' : 'confirmEmail')}</h1>
      {confirmed ? <p role="status">{t(transitioning?'transitionComplete':guardianInvitation?guardianRenewal?'renewalAccepted':'guardianAccepted':successor ? declined?'successorDeclined':'successorAccepted' : familyInvitation ? 'familyJoined' : settingUp ? 'setupComplete' : resetting ? 'resetComplete' : changingEmail ? 'emailChanged' : 'emailConfirmed')}</p> : invalid ? <p role="alert">{t(supported ? transitioning?'transitionInvalid':guardianInvitation?'guardianInvalid':familyInvitation ? 'familyInvalid' : settingUp ? 'setupInvalid' : resetting ? 'resetInvalid' : 'confirmationInvalid' : 'unsupportedAction')}</p>
        : transitioning && token.current ? <DependentTransitionConfirmation key={linkVersion} api={api} t={t} token={token.current} onCompleted={()=>{if(generation.current===currentGeneration){token.current=null;setConfirmed(true);}}} onInvalid={()=>{if(generation.current===currentGeneration){token.current=null;setInvalid(true);}}}/>
        : familyInvitation && token.current ? <div key={linkVersion}>{(guardianInvitation?guardianRenewal?renderGuardianReactivation:renderGuardianInvitation:successor?renderFamilySuccessor:renderFamilyInvitation)?.(token.current,
          (decision?:'declined')=>{if(generation.current===currentGeneration){token.current=null;setDeclined(decision==='declined');setConfirmed(true);}},
          ()=>{if(generation.current===currentGeneration){token.current=null;setInvalid(true);}})??<p role="alert">{t('unsupportedAction')}</p>}</div>
        : (resetting || settingUp) && token.current ? <><p>{t(settingUp ? 'setupIntro' : 'resetIntro')}</p><PasswordResetForm key={linkVersion} api={api} t={t} token={token.current}
          operation={settingUp ? api.setupPassword : undefined} submitLabels={settingUp ? { ready: t('setupPassword'), pending: t('settingPassword') } : undefined}
          onRequest={controller => { if (generation.current === currentGeneration) request.current=controller; else controller.abort(); }}
          onCompleted={() => { if (generation.current === currentGeneration) { token.current=null; setConfirmed(true); } }}
          onInvalid={() => { if (generation.current === currentGeneration) { token.current=null; setInvalid(true); } }} /></>
        : <><p>{t(changingEmail ? 'emailChangeConfirmIntro' : 'confirmIntro')}</p><Button className="min-h-11" disabled={pending} onClick={() => void confirm()}>{t(pending ? 'confirmingEmail' : changingEmail ? 'confirmNewEmail' : 'confirmEmail')}</Button></>}
      {error && <p role="alert" className="text-destructive">{t('registrationUnavailable')}</p>}
      {!confirmed && !transitioning && !settingUp && !familyInvitation && <div key={linkVersion} className="flex flex-wrap gap-3">{!resetting && !changingEmail && renderConfirmationResend?.()}<RecoveryRequest api={api} t={t} /></div>}
      <a href="/" className="block text-sm underline underline-offset-4">{t(confirmed && !familyInvitation ? 'signIn' : 'returnHome')}</a>
    </main>
  </div>;
}
