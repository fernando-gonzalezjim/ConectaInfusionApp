import {useEffect,useId,useRef,useState,type FormEvent} from 'react';
import type {ActionAcceptedResponse,DependentTransitionInput,DependentTransitionResponse} from '@conecta/contracts';
import {Button} from './button';
import {Input} from './input';
import {Dialog,DialogTrigger,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './dialog';
export type TransitionKey='transitionTitle'|'transitionIntro'|'transitionRequest'|'transitionSent'|'transitionComplete'|'transitionInvalid'|'transitionConfirm'|'transitionUncertain'|'email'|'newPassword'|'confirmPassword'|'passwordPolicy'|'passwordMismatch'|'close'|'sendingRequest'|'registrationUnavailable'|'registrationInvalid';
export interface TransitionRequestApi {requestDependentTransition(id:string,input:{email:string},signal?:AbortSignal):Promise<ActionAcceptedResponse>}
export interface TransitionApi {completeDependentTransition(input:DependentTransitionInput,signal?:AbortSignal):Promise<DependentTransitionResponse>}
type Text=(key:TransitionKey)=>string;

export function DependentTransitionRequest({api,dependentId,t,onPending}:{api:TransitionRequestApi;dependentId:string;t:Text;onPending(value:boolean):void}){
  const id=useId(),request=useRef<AbortController|null>(null);
  const [open,setOpen]=useState(false),[email,setEmail]=useState(''),[pending,setPending]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState(false);
  useEffect(()=>()=>request.current?.abort(),[]);
  async function submit(event:FormEvent){event.preventDefault();if(request.current)return;const controller=new AbortController();request.current=controller;setPending(true);onPending(true);setError(false);
    try{await api.requestDependentTransition(dependentId,{email},controller.signal);if(!controller.signal.aborted)setSent(true);}
    catch{if(!controller.signal.aborted)setError(true);}
    finally{request.current=null;if(!controller.signal.aborted){setPending(false);onPending(false);}}
  }
  return <Dialog open={open} onOpenChange={value=>{if(!pending){setOpen(value);if(!value){setEmail('');setSent(false);setError(false);}}}}><DialogTrigger asChild><Button variant="outline" className="min-h-11 whitespace-normal">{t('transitionTitle')}</Button></DialogTrigger>
    <DialogContent closeLabel={t('close')} closeDisabled={pending} onEscapeKeyDown={e=>{if(pending)e.preventDefault();}} onInteractOutside={e=>{if(pending)e.preventDefault();}}><DialogHeader><DialogTitle>{t('transitionTitle')}</DialogTitle><DialogDescription>{t('transitionIntro')}</DialogDescription></DialogHeader>
      {sent?<p role="status">{t('transitionSent')}</p>:<form onSubmit={event=>void submit(event)} className="space-y-3"><label htmlFor={id}>{t('email')}</label><Input id={id} type="email" autoComplete="email" required maxLength={320} value={email} disabled={pending} onChange={e=>setEmail(e.target.value)}/><Button type="submit" disabled={pending} className="min-h-11">{t(pending?'sendingRequest':'transitionRequest')}</Button></form>}
      {error&&<p role="alert">{t('registrationUnavailable')}</p>}
    </DialogContent></Dialog>;
}

export function DependentTransitionConfirmation({api,token,t,onCompleted,onInvalid}:{api:TransitionApi;token:string;t:Text;onCompleted():void;onInvalid():void}){
  const id=useId(),request=useRef<AbortController|null>(null);
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[pending,setPending]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState<TransitionKey|null>(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  async function submit(event:FormEvent){event.preventDefault();if(request.current||uncertain)return;if(password!==confirm){setError('passwordMismatch');return;}
    const controller=new AbortController();request.current=controller;setPending(true);setError(null);
    try{await api.completeDependentTransition({token,email,password},controller.signal);if(!controller.signal.aborted)onCompleted();}
    catch(reason){if(!controller.signal.aborted){const code=reason instanceof Error&&'code'in reason?reason.code:null;if(code==='INVALID_ACTION')onInvalid();else if(code==='INVALID_REQUEST')setError('registrationInvalid');else{setUncertain(true);setError('transitionUncertain');}}}
    finally{request.current=null;if(!controller.signal.aborted){setPassword('');setConfirm('');setPending(false);}}
  }
  return <form onSubmit={event=>void submit(event)} className="space-y-4" aria-busy={pending}><p>{t('transitionIntro')}</p><fieldset disabled={pending||uncertain} className="space-y-3">
    <label htmlFor={id+'-email'}>{t('email')}</label><Input id={id+'-email'} type="email" required maxLength={320} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/>
    <label htmlFor={id+'-password'}>{t('newPassword')}</label><Input id={id+'-password'} type="password" required minLength={15} maxLength={128} autoComplete="new-password" aria-describedby={id+'-policy'} value={password} onChange={e=>setPassword(e.target.value)}/><p id={id+'-policy'}>{t('passwordPolicy')}</p>
    <label htmlFor={id+'-confirm'}>{t('confirmPassword')}</label><Input id={id+'-confirm'} type="password" required minLength={15} maxLength={128} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/>
    <Button type="submit" className="min-h-11 w-full whitespace-normal">{t(pending?'sendingRequest':'transitionConfirm')}</Button></fieldset>{error&&<p role="alert">{t(error)}</p>}
  </form>;
}
