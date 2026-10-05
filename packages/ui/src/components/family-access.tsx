import {useEffect,useId,useRef,useState,type FormEvent} from 'react';
import type {FamilyView,FamilyCreateInput,FamilyInvitationInput,FamilyInvitationActionInput,FamilyInvitationPreview,ActionAcceptedResponse,PublicAccount} from '@conecta/contracts';
import {Button} from './button';
import {Input} from './input';
import {Dialog,DialogTrigger,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './dialog';
import {FamilyResponsibility} from './family-responsibility';

export interface FamilyApi {
  getCurrentFamily(signal?:AbortSignal):Promise<{family:FamilyView|null}>;
  getAccountFamily(id:string,signal?:AbortSignal):Promise<{family:FamilyView|null}>;
  createFamily(input:FamilyCreateInput,signal?:AbortSignal):Promise<FamilyView>;
  inviteFamilyMember(id:string,input:FamilyInvitationInput,signal?:AbortSignal):Promise<ActionAcceptedResponse>;
  previewFamilyInvitation(input:FamilyInvitationActionInput,signal?:AbortSignal):Promise<FamilyInvitationPreview>;
  acceptFamilyInvitation(input:FamilyInvitationActionInput,signal?:AbortSignal):Promise<FamilyView>;
  getFamilyResponsibility(id:string,signal?:AbortSignal):Promise<{canNominate:boolean}>;
  nominateFamilySuccessor(id:string,input:FamilyInvitationInput,signal?:AbortSignal):Promise<ActionAcceptedResponse>;
  previewFamilySuccessor(input:FamilyInvitationActionInput,signal?:AbortSignal):Promise<FamilyInvitationPreview>;
  acceptFamilySuccessor(input:FamilyInvitationActionInput,signal?:AbortSignal):Promise<FamilyView>;
  declineFamilySuccessor(input:FamilyInvitationActionInput,signal?:AbortSignal):Promise<FamilyView>;
}
export type FamilyKey='myFamily'|'assistFamily'|'familyIntro'|'familyAssistIntro'|'familyName'|'createFamily'|'familyCreating'|'familyLoading'|'familyMembership'
  |'familyNoGroup'|'familyNoManagedGroup'|'familyMemberEmail'|'familySend'|'familySending'|'familySent'|'familyInviteHint'|'familyCreated'|'familyRefresh'
  |'familyUnavailable'|'familyConflict'|'familyUncertain'|'familyClosed'|'familyNoGuardianship'|'familyInvitationTitle'|'familyInvitationIntro'|'familySignInHint'
  |'familyReview'|'familyReviewing'|'familyAccept'|'familyAccepting'|'familyJoined'|'familyInvalid'|'familyExpires'|'familyCustomerRequired'|'authExpired'|'familyForbidden'|'authThrottled'|'close'|'retry'
  |'successorTitle'|'successorIntro'|'successorEmail'|'successorSend'|'successorSending'|'successorSent'|'successorAccept'|'successorDecline'|'successorDeclining'|'successorAccepted'|'successorDeclined'|'successorReadOnly'|'successorNoFinancialChange';
export type FamilyText=(key:FamilyKey)=>string;
export function familyError(error:unknown):FamilyKey{
  const code=error instanceof Error&&'code' in error?error.code:null;
  return code==='CONFLICT'?'familyConflict':code==='INVALID_ACTION'?'familyInvalid':code==='UNAUTHENTICATED'?'authExpired'
    :code==='FORBIDDEN'?'familyForbidden':code==='THROTTLED'?'authThrottled':'familyUnavailable';
}
export function FamilyAccess({api,account,t,management=false,onAccessLost}:{
  api:FamilyApi;account:PublicAccount;t:FamilyText;management?:boolean;onAccessLost:(code:'UNAUTHENTICATED'|'FORBIDDEN')=>void;
}){
  const [open,setOpen]=useState(false),[pending,setPending]=useState(false);
  return <Dialog open={open} onOpenChange={value=>{if(!pending)setOpen(value);}}>
    <DialogTrigger asChild><Button variant="outline" className="min-h-11 whitespace-normal" aria-label={management?`${t('assistFamily')}: ${account.fullName}`:t('myFamily')}>{t(management?'assistFamily':'myFamily')}</Button></DialogTrigger>
    <DialogContent closeLabel={t('close')} closeDisabled={pending} onEscapeKeyDown={event=>{if(pending)event.preventDefault();}}
      onInteractOutside={event=>{if(pending)event.preventDefault();}} className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
      <DialogHeader><DialogTitle>{t(management?'assistFamily':'myFamily')}</DialogTitle><DialogDescription>{management?`${account.fullName}. ${t('familyAssistIntro')}`:t('familyIntro')}</DialogDescription></DialogHeader>
      <FamilyPanel api={api} account={account} management={management} t={t} onPending={setPending} onAccessLost={onAccessLost} />
    </DialogContent>
  </Dialog>;
}
function FamilyPanel({api,account,management,t,onPending,onAccessLost}:{api:FamilyApi;account:PublicAccount;management:boolean;t:FamilyText;
  onPending:(pending:boolean)=>void;onAccessLost:(code:'UNAUTHENTICATED'|'FORBIDDEN')=>void;
}){
  const id=useId(),request=useRef<AbortController|null>(null);
  const [family,setFamily]=useState<FamilyView|null>(null),[loading,setLoading]=useState(true),[attempt,setAttempt]=useState(0);
  const [known,setKnown]=useState(false);
  const [pending,setPending]=useState<'create'|'invite'|null>(null),[error,setError]=useState<FamilyKey|null>(null),[message,setMessage]=useState<FamilyKey|null>(null);
  const [name,setName]=useState(''),[email,setEmail]=useState(''),[uncertain,setUncertain]=useState(false),[successorPending,setSuccessorPending]=useState(false);
  function failure(error:unknown){setError(familyError(error));if(error instanceof Error&&'code' in error&&(error.code==='UNAUTHENTICATED'||error.code==='FORBIDDEN'))onAccessLost(error.code);}
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setKnown(false);setError(null);setMessage(null);
    (management?api.getAccountFamily(account.id,controller.signal):api.getCurrentFamily(controller.signal))
      .then(result=>{if(!controller.signal.aborted){setFamily(result.family);setKnown(true);setUncertain(false);}})
      .catch(error=>{if(!controller.signal.aborted)failure(error);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[api,account.id,management,attempt]);
  useEffect(()=>()=>request.current?.abort(),[]);
  async function submit(event:FormEvent,kind:'create'|'invite'){
    event.preventDefault();if(request.current||uncertain)return;
    const controller=new AbortController();request.current=controller;setPending(kind);onPending(true);setError(null);setMessage(null);
    try{
      if(kind==='create'){const result=await api.createFamily({name:name.trim()},controller.signal);if(!controller.signal.aborted){setFamily(result);setName('');setMessage('familyCreated');}}
      else if(family){await api.inviteFamilyMember(family.id,{email:email.trim()},controller.signal);if(!controller.signal.aborted){setEmail('');setMessage('familySent');}}
    }catch(error){if(!controller.signal.aborted){failure(error);if(familyError(error)==='familyUnavailable'){setUncertain(true);setError('familyUncertain');}}}
    finally{if(request.current===controller){request.current=null;if(!controller.signal.aborted){setPending(null);onPending(false);}}}
  }
  return <div className="space-y-5" aria-busy={loading||pending!==null}>
    {loading?<p role="status">{t('familyLoading')}</p>:<>
      {known&&(family?<><h3 className="break-words text-xl font-semibold">{family.name}</h3><p className="text-sm">{t(family.status==='closed'?'familyClosed':'familyMembership')}</p>
        {family.status==='active'&&<form onSubmit={e=>void submit(e,'invite')} className="space-y-3"><fieldset disabled={pending!==null||successorPending||uncertain} className="space-y-3">
          <label htmlFor={id+'-email'} className="block text-sm font-medium">{t('familyMemberEmail')}</label><Input id={id+'-email'} type="email" autoComplete="email" required maxLength={320} value={email} onChange={e=>setEmail(e.target.value)} />
          <Button type="submit" className="min-h-11 w-full">{t(pending==='invite'?'familySending':'familySend')}</Button>
        </fieldset><p className="text-sm text-muted-foreground">{t('familyInviteHint')}</p></form>}
        {family.status==='active'&&<FamilyResponsibility key={family.id+':'+attempt} api={api} familyId={family.id} t={t} disabled={pending!==null||uncertain}
          onPending={value=>{setSuccessorPending(value);onPending(value);}} onAccessLost={onAccessLost} />}
      </>:management?<p>{t('familyNoManagedGroup')}</p>:<><p>{t('familyNoGroup')}</p><form onSubmit={e=>void submit(e,'create')} className="space-y-3"><fieldset disabled={pending!==null||uncertain} className="space-y-3">
        <label htmlFor={id+'-name'} className="block text-sm font-medium">{t('familyName')}</label><Input id={id+'-name'} autoFocus required maxLength={120} value={name} onChange={e=>setName(e.target.value)} />
        <Button type="submit" className="min-h-11 w-full" disabled={!name.trim()}>{t(pending==='create'?'familyCreating':'createFamily')}</Button>
      </fieldset></form></>)}
      <Button variant="outline" disabled={pending!==null||successorPending} onClick={()=>setAttempt(value=>value+1)}>{t('familyRefresh')}</Button>
    </>}
    <p className="text-sm text-muted-foreground">{t('familyNoGuardianship')}</p>
    {message&&<p role="status" className="text-sm">{t(message)}</p>}{error&&<p role="alert" className="text-sm text-destructive">{t(error)}</p>}
  </div>;
}
