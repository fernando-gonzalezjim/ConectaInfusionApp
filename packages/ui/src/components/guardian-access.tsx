import {useEffect,useId,useRef,useState,type FormEvent} from 'react';
import type {ActionAcceptedResponse,GuardianInviteTarget,IdentityPage} from '@conecta/contracts';
import {Button} from './button';
import {Input} from './input';
import {Dialog,DialogTrigger,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './dialog';
import {GuardianRemoval,type GuardianRemovalApi,type GuardianRemovalKey} from './guardian-removal';
export interface GuardianApi extends GuardianRemovalApi {
  inviteGuardian(id:string,input:{email:string},signal?:AbortSignal):Promise<ActionAcceptedResponse>;
  listGuardianInviteTargets(id:string,query?:{limit?:number;cursor?:string},signal?:AbortSignal):Promise<IdentityPage<GuardianInviteTarget>>;
}
export type GuardianKey=GuardianRemovalKey|'guardianTitle'|'guardianIntro'|'guardianAccepted'|'guardianInvite'|'guardianEmail'|'guardianSend'|'guardianSending'|'guardianSent'|'guardianHint'|'guardianReview'|'guardianAccept'|'guardianInvalid'|'guardianCustomerRequired'|'guardianNoOtherAccess'|'guardianAssist'|'guardianAssistIntro'|'guardianSelect'|'guardianEmpty'|'guardianUnavailable'|'guardianUncertain'|'childrenLoading'|'childrenNext'|'childrenPrevious'|'childrenRefresh'|'authExpired'|'authForbidden'|'authThrottled'|'close';
export type GuardianText=(key:GuardianKey)=>string;
export function guardianError(error:unknown):GuardianKey{
  const code=error instanceof Error&&'code' in error?error.code:null;
  return code==='UNAUTHENTICATED'?'authExpired':code==='FORBIDDEN'?'authForbidden':code==='INVALID_ACTION'?'guardianInvalid':code==='THROTTLED'?'authThrottled':'guardianUnavailable';
}
export function GuardianAccess({api,t,dependent,accountId,onAccessLost}:{api:GuardianApi;t:GuardianText;dependent?:GuardianInviteTarget;accountId?:string;onAccessLost:(code:'UNAUTHENTICATED'|'FORBIDDEN')=>void}){
  const [open,setOpen]=useState(false),[pending,setPending]=useState(false);
  return <Dialog open={open} onOpenChange={value=>{if(!pending)setOpen(value);}}>
    <DialogTrigger asChild><Button variant="outline" className="min-h-11 whitespace-normal" aria-label={dependent?`${t('guardianInvite')}: ${dependent.fullName}`:undefined}>{t(dependent?'guardianInvite':'guardianAssist')}</Button></DialogTrigger>
    <DialogContent closeLabel={t('close')} closeDisabled={pending} onEscapeKeyDown={event=>{if(pending)event.preventDefault();}} onInteractOutside={event=>{if(pending)event.preventDefault();}} className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
      <DialogHeader><DialogTitle>{t(dependent?'guardianInvite':'guardianAssist')}</DialogTitle><DialogDescription>{t(dependent?'guardianHint':'guardianAssistIntro')}</DialogDescription></DialogHeader>
      <GuardianPanel api={api} t={t} dependent={dependent} accountId={accountId} onAccessLost={onAccessLost} onPending={setPending}/>
    </DialogContent>
  </Dialog>;
}
function GuardianPanel({api,t,dependent,accountId,onAccessLost,onPending}:{api:GuardianApi;t:GuardianText;dependent?:GuardianInviteTarget;accountId?:string;onAccessLost:(code:'UNAUTHENTICATED'|'FORBIDDEN')=>void;onPending:(value:boolean)=>void}){
  const id=useId(),request=useRef<AbortController|null>(null);
  const [page,setPage]=useState<IdentityPage<GuardianInviteTarget>|null>(null),[cursors,setCursors]=useState<(string|undefined)[]>([undefined]),[attempt,setAttempt]=useState(0);
  const [selected,setSelected]=useState(dependent?.id??''),[email,setEmail]=useState(''),[loading,setLoading]=useState(!dependent),[pending,setPending]=useState(false),[uncertain,setUncertain]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState<GuardianKey|null>(null);
  const cursor=cursors.at(-1);
  function failure(reason:unknown){const key=guardianError(reason);setError(key);if(key==='authExpired'||key==='authForbidden')onAccessLost(key==='authExpired'?'UNAUTHENTICATED':'FORBIDDEN');}
  useEffect(()=>{
    if(dependent)return;const controller=new AbortController();setLoading(true);setPage(null);setSelected('');setError(null);
    if(!accountId){setLoading(false);setError('guardianUnavailable');return;}
    api.listGuardianInviteTargets(accountId,{limit:10,cursor},controller.signal).then(value=>{if(!controller.signal.aborted){setPage(value);setUncertain(false);}}).catch(reason=>{if(!controller.signal.aborted)failure(reason);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[api,dependent,accountId,cursor,attempt,onAccessLost]);
  useEffect(()=>()=>request.current?.abort(),[]);
  async function submit(event:FormEvent){
    event.preventDefault();if(request.current||!selected||uncertain||loading)return;
    const controller=new AbortController();request.current=controller;setPending(true);onPending(true);setSent(false);setError(null);
    try{await api.inviteGuardian(selected,{email:email.trim()},controller.signal);if(!controller.signal.aborted){setSent(true);setEmail('');}}
    catch(reason){if(!controller.signal.aborted){failure(reason);const code=reason instanceof Error&&'code' in reason?reason.code:null;if(!['INVALID_REQUEST','THROTTLED','UNAUTHENTICATED','FORBIDDEN','NOT_FOUND'].includes(String(code))){setUncertain(true);setError('guardianUncertain');}if(code==='NOT_FOUND'){setSelected('');setPage(null);}}}
    finally{if(request.current===controller){request.current=null;if(!controller.signal.aborted){setPending(false);onPending(false);}}}
  }
  return <div className="space-y-4" aria-busy={loading||pending}>
    {loading?<p role="status">{t('childrenLoading')}</p>:dependent||page?.items.length?<form onSubmit={event=>void submit(event)} className="space-y-3"><fieldset disabled={pending||uncertain} className="space-y-3">
      {dependent?<h3 className="break-words font-semibold">{dependent.fullName}</h3>:<><label htmlFor={id+'-child'}>{t('guardianSelect')}</label><select id={id+'-child'} className="min-h-11 w-full rounded-md border bg-background px-3" required value={selected} onChange={event=>{setSelected(event.target.value);setSent(false);}}><option value="">{t('guardianSelect')}</option>{page!.items.map(child=><option key={child.id} value={child.id}>{child.fullName}</option>)}</select></>}
      <label htmlFor={id+'-email'} className="block text-sm font-medium">{t('guardianEmail')}</label><Input id={id+'-email'} type="email" required maxLength={320} autoComplete="email" value={email} onChange={event=>{setEmail(event.target.value);setSent(false);}}/>
      <Button type="submit" className="min-h-11 w-full whitespace-normal" disabled={!selected||!email.trim()}>{t(pending?'guardianSending':'guardianSend')}</Button>
    </fieldset></form>:page&&<p>{t('guardianEmpty')}</p>}
    {!dependent&&<><nav className="flex flex-wrap gap-2"><Button variant="outline" className="min-h-11" disabled={pending||loading||uncertain||cursors.length===1} onClick={()=>setCursors(values=>values.slice(0,-1))}>{t('childrenPrevious')}</Button><Button variant="outline" className="min-h-11" disabled={pending||loading||uncertain||!page?.nextCursor} onClick={()=>setCursors(values=>[...values,page!.nextCursor!])}>{t('childrenNext')}</Button></nav><Button variant="outline" className="min-h-11" disabled={pending||loading} onClick={()=>{setSent(false);setAttempt(value=>value+1);}}>{t('childrenRefresh')}</Button></>}
    {!dependent&&selected&&page?.items.find(child=>child.id===selected)&&<GuardianRemoval api={api} t={t} dependent={page.items.find(child=>child.id===selected)!} onAccessLost={onAccessLost} onRemoved={()=>{setSelected('');setPage(null);setAttempt(value=>value+1);}}/>}
    <p className="text-sm text-muted-foreground">{t('guardianHint')}</p><p className="text-sm text-muted-foreground">{t('guardianNoOtherAccess')}</p>
    {sent&&<p role="status">{t('guardianSent')}</p>}{error&&<p role="alert" className="text-sm text-destructive">{t(error)}</p>}
  </div>;
}
