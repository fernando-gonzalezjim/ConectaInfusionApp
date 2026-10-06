import {useEffect,useId,useRef,useState} from 'react';
import type {AccountLifecycleState,AccountDeactivationRequest,AccountDeactivationExecutionRequest,AccountDeactivationPreview,AccountDeactivationReceipt,AccountReactivationRequest,AccountReactivationResponse} from '@conecta/contracts';
import {Button} from './button';
import {Dialog,DialogTrigger,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './dialog';
export type LifecycleKey='lifecycleCustomerOnly'|'lifecycleTitle'|'lifecycleIntro'|'lifecycleLoading'|'lifecycleRefresh'|'lifecyclePreview'|'lifecycleReady'|'lifecycleBlocked'|'lifecycleUnavailable'|'lifecycleConflict'|'lifecycleRecentAuth'|'lifecycleKeep'|'lifecycleLeaveCredits'|'lifecycleCreditHint'|'lifecycleJoint'|'lifecycleOtherGuardian'|'lifecycleJointHint'|'lifecycleConfirm'|'lifecycleConfirmLabel'|'lifecycleDeactivate'|'lifecycleApplied'|'lifecycleUncertain'|'lifecycleSelfUncertain'|'lifecycleRetry'|'lifecycleReactivate'|'lifecycleRestored'|'lifecycleAccessOnly'|'lifecyclePending'|'lifecycleFamilyLeave'|'lifecycleFamilyClose'|'lifecycleFamilyBlocked'|'renewalTitle'|'renewalIntro'|'renewalReview'|'renewalAccept'|'renewalAccepted'|'renewalInactive'|'renewalSend'|'renewalSent'|'renewalPending'|'renewalComplete'|'renewalCompleted'|'renewalNoEligible'|'renewalNoCandidates'|'renewalSelect'|'renewalEligible'|'renewalIneligible'|'renewalConsent'|'renewalCooldown'|'authExpired'|'authForbidden'|'authThrottled'|'close'|'retry'|'childrenPrevious'|'childrenNext';
export type LifecycleText=(key:LifecycleKey)=>string;
export interface AccountLifecycleApi {
 getAccountLifecycle(id:string,signal?:AbortSignal):Promise<AccountLifecycleState>;
 previewAccountDeactivation(id:string,input:AccountDeactivationRequest,signal?:AbortSignal):Promise<AccountDeactivationPreview>;
 deactivateAccount(id:string,input:AccountDeactivationExecutionRequest,signal?:AbortSignal):Promise<AccountDeactivationReceipt>;
 reactivateAccount(id:string,input:AccountReactivationRequest,signal?:AbortSignal):Promise<AccountReactivationResponse>;
}
export function lifecycleError(error:unknown):LifecycleKey{
 const code=error instanceof Error&&'code'in error?error.code:null;
 return code==='UNAUTHENTICATED'?'authExpired':code==='FORBIDDEN'?'authForbidden':code==='RECENT_AUTH_REQUIRED'?'lifecycleRecentAuth':code==='CONFLICT'||code==='NOT_FOUND'?'lifecycleConflict':code==='THROTTLED'?'authThrottled':'lifecycleUnavailable';
}
export function AccountLifecycle({api,accountId,fullName,self=false,management=false,canDeactivate=true,t,onAccessLost,onChanged}: {api:AccountLifecycleApi;accountId:string;fullName:string;self?:boolean;management?:boolean;canDeactivate?:boolean;t:LifecycleText;onAccessLost:(code:'UNAUTHENTICATED'|'FORBIDDEN')=>void;onChanged?:()=>void}){
 const [open,setOpen]=useState(false),[pending,setPending]=useState(false);
 return <Dialog open={open} onOpenChange={value=>{if(!pending)setOpen(value);}}><DialogTrigger asChild><Button variant="outline" className="min-h-11 whitespace-normal" aria-label={`${t('lifecycleTitle')}: ${fullName}`}>{t('lifecycleTitle')}</Button></DialogTrigger>
  <DialogContent closeLabel={t('close')} closeDisabled={pending} onEscapeKeyDown={e=>{if(pending)e.preventDefault();}} onInteractOutside={e=>{if(pending)e.preventDefault();}} className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
   <DialogHeader><DialogTitle>{t('lifecycleTitle')}</DialogTitle><DialogDescription>{fullName}. {t('lifecycleIntro')}</DialogDescription></DialogHeader>
   <AccountLifecyclePanel api={api} accountId={accountId} self={self} management={management} canDeactivate={canDeactivate} t={t} onAccessLost={onAccessLost} onChanged={onChanged} onPending={setPending}/>
  </DialogContent></Dialog>;
}
function AccountLifecyclePanel({api,accountId,self,management,canDeactivate,t,onAccessLost,onChanged,onPending}:{api:AccountLifecycleApi;accountId:string;self:boolean;management:boolean;canDeactivate:boolean;t:LifecycleText;onAccessLost:(code:'UNAUTHENTICATED'|'FORBIDDEN')=>void;onChanged?:()=>void;onPending:(busy:boolean)=>void}){
 const id=useId(),request=useRef<AbortController|null>(null),execution=useRef<AccountDeactivationExecutionRequest|null>(null);
 const [state,setState]=useState<AccountLifecycleState|null>(null),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(0),[loading,setLoading]=useState(true);
 const [choice,setChoice]=useState<'keep'|'leave-family'|null>(null),[children,setChildren]=useState<string[]>([]),[preview,setPreview]=useState<AccountDeactivationPreview|null>(null),[confirmed,setConfirmed]=useState(false);
 const [error,setError]=useState<LifecycleKey|null>(null),[message,setMessage]=useState<LifecycleKey|null>(null),[uncertain,setUncertain]=useState<'execute'|'restore'|null>(null),[applied,setApplied]=useState(false);
 function fail(e:unknown){const key=lifecycleError(e);setError(key);if(key==='authExpired'||key==='authForbidden')onAccessLost(key==='authExpired'?'UNAUTHENTICATED':'FORBIDDEN');}
 useEffect(()=>{const c=new AbortController();setLoading(true);setError(null);setState(null);setPreview(null);setConfirmed(false);
  api.getAccountLifecycle(accountId,c.signal).then(s=>{if(!c.signal.aborted){setState(s);setChildren([]);setUncertain(null);execution.current=null;}}).catch(e=>{if(!c.signal.aborted)fail(e);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();
 },[api,accountId,attempt]);
 useEffect(()=>()=>request.current?.abort(),[]);
 function invalidate(){setPreview(null);setConfirmed(false);execution.current=null;setError(null);setMessage(null);}
 async function act(kind:'preview'|'execute'|'restore'){
  if(request.current||!state||applied||kind==='preview'&&self&&!choice)return;const c=new AbortController();request.current=c;setBusy(true);onPending(true);setError(null);setMessage(null);
  const input:AccountDeactivationRequest={confirmation:true,...(self&&choice?{creditChoice:choice}:{}),dependentPersonIds:children};
  try{
   if(kind==='preview'){setPreview(null);setConfirmed(false);execution.current=null;const result=await api.previewAccountDeactivation(accountId,input,c.signal);if(!c.signal.aborted)setPreview(result);}
   else if(kind==='restore'){await api.reactivateAccount(accountId,{confirmation:true,expectedSessionVersion:state.sessionVersion},c.signal);if(!c.signal.aborted){setApplied(true);setMessage('lifecycleRestored');onChanged?.();}}
   else{if(!execution.current){if(preview?.status!=='ready'||!confirmed)return;execution.current={...input,expectedRevision:preview.revision,idempotencyKey:crypto.randomUUID()};}
    await api.deactivateAccount(accountId,execution.current,c.signal);if(!c.signal.aborted){setApplied(true);setMessage('lifecycleApplied');if(self)onAccessLost('UNAUTHENTICATED');else onChanged?.();}}
  }catch(e){if(!c.signal.aborted){fail(e);const key=lifecycleError(e);if(kind!=='preview'&&key==='lifecycleUnavailable'){setUncertain(kind==='execute'?'execute':'restore');setError(self&&kind==='execute'?'lifecycleSelfUncertain':'lifecycleUncertain');}else{setUncertain(null);setPreview(null);setConfirmed(false);execution.current=null;}}}
  finally{if(request.current===c){request.current=null;if(!c.signal.aborted){setBusy(false);onPending(false);}}}
 }
 return <div className="space-y-4" aria-busy={loading||busy}>
  {loading?<p role="status">{t('lifecycleLoading')}</p>:state&&!applied?<>
   <p className="text-sm">{t('lifecycleAccessOnly')}</p>
   {state.status==='inactive'?management&&<><p>{t('lifecycleConfirmLabel')}</p><label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={confirmed} disabled={busy||!!uncertain} onChange={e=>setConfirmed(e.target.checked)}/>{t('lifecycleConfirm')}</label><Button className="min-h-11 w-full" disabled={!confirmed||busy||!!uncertain} onClick={()=>void act('restore')}>{t('lifecycleReactivate')}</Button></>:state.status==='active'&&canDeactivate?<>
    <fieldset disabled={busy||!!uncertain} className="space-y-3">
     {self&&<><legend className="font-semibold">{t('lifecycleCreditHint')}</legend>{(['keep','leave-family'] as const).map(value=><label key={value} className="flex min-h-11 items-center gap-3"><input type="radio" name={id+'-credit'} checked={choice===value} onChange={()=>{setChoice(value);invalidate();}}/>{t(value==='keep'?'lifecycleKeep':'lifecycleLeaveCredits')}</label>)}</>}
     {state.dependents.length>0&&<div className="space-y-2"><h3 className="font-semibold">{t('lifecycleJoint')}</h3><p className="text-sm">{t('lifecycleJointHint')}</p>{state.dependents.map(child=>child.canDeactivateTogether?<label key={child.id} className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={children.includes(child.id)} onChange={e=>{setChildren(old=>e.target.checked?[...old,child.id]:old.filter(v=>v!==child.id));invalidate();}}/><span className="break-words">{child.fullName}</span></label>:<p key={child.id} className="break-words text-sm">{child.fullName}: {t('lifecycleOtherGuardian')}</p>)}</div>}
     <Button variant="outline" className="min-h-11 w-full" disabled={self&&!choice} onClick={()=>void act('preview')}>{t('lifecyclePreview')}</Button>
    </fieldset>
    {preview?.status==='blocked'&&<p role="status">{t('lifecycleBlocked')}</p>}
    {preview?.status==='ready'&&<><p role="status">{t('lifecycleReady')}</p><label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={confirmed} disabled={busy||!!uncertain} onChange={e=>setConfirmed(e.target.checked)}/>{t('lifecycleConfirm')}</label></>}
    <Button variant="destructive" className="min-h-11 w-full whitespace-normal" disabled={busy||!confirmed||preview?.status!=='ready'||!!uncertain} onClick={()=>void act('execute')}>{t('lifecycleDeactivate')}</Button>
   </>:<p>{t(state.status==='active'?'lifecycleCustomerOnly':'lifecyclePending')}</p>}
  </>:null}
  {message&&<p role="status">{t(message)}</p>}{error&&<p role="alert" className="text-destructive text-sm">{t(error)}</p>}
  {uncertain==='execute'&&!self&&<Button className="min-h-11 w-full" disabled={busy} onClick={()=>void act('execute')}>{t('lifecycleRetry')}</Button>}
  {!applied&&<Button variant="outline" disabled={busy||uncertain==='execute'} onClick={()=>setAttempt(v=>v+1)}>{t('lifecycleRefresh')}</Button>}
 </div>;
}
export function FamilyLifecycleUnavailable({t}: {t:LifecycleText}){const id=useId();return <section className="space-y-3 border-t pt-4" aria-describedby={id}><p id={id} className="text-sm">{t('lifecycleFamilyBlocked')}</p><div className="flex flex-wrap gap-3"><Button variant="outline" disabled>{t('lifecycleFamilyLeave')}</Button><Button variant="outline" disabled>{t('lifecycleFamilyClose')}</Button></div></section>;}
