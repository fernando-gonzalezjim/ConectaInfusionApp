import {useEffect,useId,useRef,useState,type FormEvent} from 'react';
import type {FamilyApi,FamilyKey,FamilyText} from './family-access';
import {familyError} from './family-access';
import {Button} from './button';
import {Input} from './input';

export function FamilyResponsibility({api,familyId,t,disabled,onPending,onAccessLost}:{api:FamilyApi;familyId:string;t:FamilyText;disabled:boolean;
  onPending:(pending:boolean)=>void;onAccessLost:(code:'UNAUTHENTICATED'|'FORBIDDEN')=>void;
}){
  const id=useId(),request=useRef<AbortController|null>(null);
  const [allowed,setAllowed]=useState<boolean|null>(null),[email,setEmail]=useState(''),[pending,setPending]=useState(false);
  const [error,setError]=useState<FamilyKey|null>(null),[sent,setSent]=useState(false),[uncertain,setUncertain]=useState(false),[attempt,setAttempt]=useState(0);
  const lost=useRef(onAccessLost);lost.current=onAccessLost;
  function failure(e:unknown){setError(familyError(e));if(e instanceof Error&&'code' in e&&(e.code==='UNAUTHENTICATED'||e.code==='FORBIDDEN'))lost.current(e.code);}
  useEffect(()=>{
    const controller=new AbortController();setAllowed(null);setError(null);setSent(false);
    api.getFamilyResponsibility(familyId,controller.signal).then(result=>{if(!controller.signal.aborted){setAllowed(result.canNominate);setUncertain(false);}}).catch(e=>{if(!controller.signal.aborted)failure(e);});
    return()=>controller.abort();
  },[api,familyId,attempt]);
  useEffect(()=>()=>request.current?.abort(),[]);
  async function submit(event:FormEvent){
    event.preventDefault();if(disabled||!allowed||uncertain||request.current)return;
    const controller=new AbortController();request.current=controller;setPending(true);onPending(true);setSent(false);setError(null);
    try{await api.nominateFamilySuccessor(familyId,{email:email.trim()},controller.signal);if(!controller.signal.aborted){setSent(true);setEmail('');}}
    catch(e){if(!controller.signal.aborted){failure(e);if(familyError(e)==='familyUnavailable'){setUncertain(true);setError('familyUncertain');}}}
    finally{if(request.current===controller){request.current=null;if(!controller.signal.aborted){setPending(false);onPending(false);}}}
  }
  return <section className="space-y-3 border-t pt-4" aria-busy={pending} aria-labelledby={id+'-title'}>
    <h4 id={id+'-title'} className="font-semibold">{t('successorTitle')}</h4>
    <p className="text-sm text-muted-foreground">{t('successorNoFinancialChange')}</p>
    {allowed===null&&!error?<p role="status">{t('familyLoading')}</p>:allowed?<form onSubmit={e=>void submit(e)}><fieldset disabled={disabled||pending||uncertain} className="space-y-3">
      <label htmlFor={id+'-email'} className="block text-sm font-medium">{t('successorEmail')}</label>
      <Input id={id+'-email'} type="email" autoComplete="email" required maxLength={320} value={email} onChange={e=>setEmail(e.target.value)} />
      <Button type="submit" className="min-h-11 w-full">{t(pending?'successorSending':'successorSend')}</Button>
    </fieldset></form>:allowed===false?<p className="text-sm">{t('successorReadOnly')}</p>:null}
    {sent&&<p role="status" className="text-sm">{t('successorSent')}</p>}{error&&<p role="alert" className="text-sm text-destructive">{t(error)}</p>}
    {error&&<Button variant="outline" disabled={disabled||pending} onClick={()=>setAttempt(v=>v+1)}>{t('familyRefresh')}</Button>}
  </section>;
}
