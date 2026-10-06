import {useEffect,useId,useRef,useState} from 'react';
import type {DependentReactivationState,IdentityPage,GuardianInviteTarget,GuardianReactivationInvitationRequest,DependentReactivationRequest,ActionAcceptedResponse} from '@conecta/contracts';
import {Button} from './button';
import {Dialog,DialogTrigger,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './dialog';
import {lifecycleError,type LifecycleText,type LifecycleKey} from './account-lifecycle';
export interface DependentReactivationApi{
 listReactivationCandidates(query?:{limit?:number;cursor?:string},signal?:AbortSignal):Promise<IdentityPage<GuardianInviteTarget>>;
 getDependentReactivation(id:string,signal?:AbortSignal):Promise<DependentReactivationState>;
 inviteGuardianReactivation(id:string,input:GuardianReactivationInvitationRequest,signal?:AbortSignal):Promise<ActionAcceptedResponse>;
 reactivateDependent(id:string,input:DependentReactivationRequest,signal?:AbortSignal):Promise<{dependentId:string;guardianRelationshipId:string}>;
}
export function DependentReactivation({api,t,onAccessLost}:{api:DependentReactivationApi;t:LifecycleText;onAccessLost:(code:'UNAUTHENTICATED'|'FORBIDDEN')=>void}){
 const [open,setOpen]=useState(false),[pending,setPending]=useState(false);
 return <Dialog open={open} onOpenChange={value=>{if(!pending)setOpen(value);}}><DialogTrigger asChild><Button variant="outline" className="min-h-11 whitespace-normal">{t('renewalTitle')}</Button></DialogTrigger><DialogContent closeLabel={t('close')} closeDisabled={pending} onEscapeKeyDown={e=>{if(pending)e.preventDefault();}} onInteractOutside={e=>{if(pending)e.preventDefault();}} className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg"><DialogHeader><DialogTitle>{t('renewalTitle')}</DialogTitle><DialogDescription>{t('renewalIntro')}</DialogDescription></DialogHeader><RenewalPanel api={api} t={t} onAccessLost={onAccessLost} onPending={setPending}/></DialogContent></Dialog>;
}
function RenewalPanel({api,t,onAccessLost,onPending}:{api:DependentReactivationApi;t:LifecycleText;onAccessLost:(code:'UNAUTHENTICATED'|'FORBIDDEN')=>void;onPending:(value:boolean)=>void}){
 const id=useId(),request=useRef<AbortController|null>(null);
 const [page,setPage]=useState<IdentityPage<GuardianInviteTarget>|null>(null),[cursors,setCursors]=useState<(string|undefined)[]>([undefined]),[selected,setSelected]=useState(''),[state,setState]=useState<DependentReactivationState|null>(null);
 const [attempt,setAttempt]=useState(0),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[confirmed,setConfirmed]=useState(false),[uncertain,setUncertain]=useState(false),[message,setMessage]=useState<LifecycleKey|null>(null),[error,setError]=useState<LifecycleKey|null>(null);
 function fail(e:unknown){const key=lifecycleError(e);setError(key);if(key==='authExpired'||key==='authForbidden')onAccessLost(key==='authExpired'?'UNAUTHENTICATED':'FORBIDDEN');}
 const cursor=cursors.at(-1);
 useEffect(()=>{const c=new AbortController();setLoading(true);setPage(null);setSelected('');setState(null);setConfirmed(false);setError(null);
 api.listReactivationCandidates({limit:25,cursor},c.signal).then(p=>{if(!c.signal.aborted){setPage(p);setUncertain(false);}}).catch(e=>{if(!c.signal.aborted)fail(e);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[api,cursor,attempt]);
 useEffect(()=>{if(!selected)return;const c=new AbortController();setState(null);setConfirmed(false);setError(null);setMessage(null);setLoading(true);api.getDependentReactivation(selected,c.signal).then(s=>{if(!c.signal.aborted)setState(s);}).catch(e=>{if(!c.signal.aborted)fail(e);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[api,selected]);
 useEffect(()=>()=>request.current?.abort(),[]);
 async function act(guardian:DependentReactivationState['guardians'][number]){
  if(request.current||!state||uncertain||!guardian.eligible||guardian.acceptedInvitationId&&!confirmed)return;const c=new AbortController();request.current=c;setBusy(true);onPending(true);setError(null);setMessage(null);
  try{if(guardian.acceptedInvitationId){await api.reactivateDependent(state.dependent.id,{confirmation:true,invitationId:guardian.acceptedInvitationId,expectedDeactivationSequence:state.deactivationSequence},c.signal);if(!c.signal.aborted){setMessage('renewalCompleted');setState(null);setSelected('');setPage(null);setUncertain(true);}}
   else{await api.inviteGuardianReactivation(state.dependent.id,{guardianAccountId:guardian.accountId,expectedDeactivationSequence:state.deactivationSequence},c.signal);if(!c.signal.aborted){setMessage('renewalSent');setUncertain(true);}}}
  catch(e){if(!c.signal.aborted){fail(e);setState(null);setConfirmed(false);setUncertain(true);}}
  finally{if(request.current===c){request.current=null;if(!c.signal.aborted){setBusy(false);onPending(false);}}}
 }
 return <div className="space-y-4" aria-busy={loading||busy}>
  {loading&&<p role="status">{t('lifecycleLoading')}</p>}
  {page&&<><label htmlFor={id} className="block text-sm font-medium">{t('renewalSelect')}</label><select id={id} value={selected} disabled={loading||busy||uncertain} onChange={e=>{setState(null);setConfirmed(false);setSelected(e.target.value);}} className="w-full rounded-md border bg-background p-3"><option value="">{t('renewalSelect')}</option>{page.items.map(p=><option key={p.id} value={p.id}>{p.fullName}</option>)}</select>{page.items.length===0&&<p>{t('renewalNoCandidates')}</p>}</>}
  {state&&<><p>{t('renewalInactive')}</p><p className="text-sm">{t('renewalConsent')}</p>{!state.guardians.some(g=>g.eligible)&&<p role="status">{t('renewalNoEligible')}</p>}
   <ul className="space-y-3">{state.guardians.map(g=><li key={g.accountId} className="space-y-2 rounded-md border p-3"><p className="break-words font-medium">{g.fullName}</p><p className="text-sm">{t(g.eligible?g.acceptedInvitationId?'renewalEligible':'renewalPending':'renewalIneligible')}</p><Button className="min-h-11 w-full whitespace-normal" disabled={busy||uncertain||!g.eligible||!!g.acceptedInvitationId&&!confirmed} onClick={()=>void act(g)}>{t(g.acceptedInvitationId?'renewalComplete':'renewalSend')}</Button></li>)}</ul>
   {state.guardians.some(g=>g.eligible&&g.acceptedInvitationId)&&<label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={confirmed} disabled={busy||uncertain} onChange={e=>setConfirmed(e.target.checked)}/>{t('lifecycleConfirm')}</label>}
  </>}
  <p className="text-sm text-muted-foreground">{t('renewalCooldown')}</p>{message&&<p role="status">{t(message)}</p>}{error&&<p role="alert" className="text-sm text-destructive">{t(error)}</p>}
  <Button variant="outline" disabled={busy||loading} onClick={()=>{setMessage(null);setAttempt(v=>v+1);}}>{t('lifecycleRefresh')}</Button>
  {page&&<nav className="flex flex-wrap gap-3"><Button variant="outline" disabled={busy||loading||cursors.length===1} onClick={()=>setCursors(v=>v.slice(0,-1))}>{t('childrenPrevious')}</Button><Button variant="outline" disabled={busy||loading||!page.nextCursor} onClick={()=>setCursors(v=>[...v,page.nextCursor!])}>{t('childrenNext')}</Button></nav>}
 </div>;
}
