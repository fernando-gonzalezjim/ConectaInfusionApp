import {useCallback,useEffect,useRef,useState} from 'react';
import type {PublicAccount,GuardianInvitationPreview,GuardianInvitationAccepted,Locale,LoginInput,LoginResponse,SessionResponse} from '@conecta/contracts';
import {AccountAccess,type AccountLabels} from './account-access';
import {Button} from './button';
import {guardianError,type GuardianKey} from './guardian-access';
interface InvitationApi {
  getSession(signal?:AbortSignal):Promise<SessionResponse>;login(input:LoginInput,signal?:AbortSignal):Promise<LoginResponse>;
  logout(signal?:AbortSignal):Promise<void>;logoutAll(signal?:AbortSignal):Promise<void>;
  previewGuardianInvitation(input:{token:string},signal?:AbortSignal):Promise<GuardianInvitationPreview>;
  acceptGuardianInvitation(input:{token:string},signal?:AbortSignal):Promise<GuardianInvitationAccepted>;
}
type Text=(key:GuardianKey|'familySignInHint'|'familyExpires'|'familyReviewing'|'familyAccepting')=>string;
export function GuardianInvitation({api,token,t,locale,labels,onCompleted,onInvalid}:{api:InvitationApi;token:string;t:Text;locale:Locale;labels:AccountLabels;onCompleted:()=>void;onInvalid:()=>void}){
  const [account,setAccount]=useState<PublicAccount|null>(null),[epoch,setEpoch]=useState(0),[preview,setPreview]=useState<GuardianInvitationPreview|null>(null);
  const [pending,setPending]=useState<'preview'|'accept'|null>(null),[error,setError]=useState<GuardianKey|null>(null),[uncertain,setUncertain]=useState(false);
  const request=useRef<AbortController|null>(null),identity=useRef<string|null>(null);
  const changed=useCallback((next:PublicAccount|null)=>{
    const key=next?JSON.stringify([next.id,next.email,[...next.roles].sort()]):null;if(identity.current===key)return;identity.current=key;
    request.current?.abort();request.current=null;setAccount(next);setPreview(null);setPending(null);setError(null);setUncertain(false);
  },[]);
  useEffect(()=>()=>request.current?.abort(),[]);
  async function act(kind:'preview'|'accept'){
    if(request.current||!account||uncertain)return;const controller=new AbortController();request.current=controller;setPending(kind);setError(null);
    try{
      if(kind==='preview'){const result=await api.previewGuardianInvitation({token},controller.signal);if(!controller.signal.aborted)setPreview(result);}
      else{await api.acceptGuardianInvitation({token},controller.signal);if(!controller.signal.aborted)onCompleted();}
    }catch(reason){if(!controller.signal.aborted){const key=guardianError(reason);
      if(key==='guardianInvalid')onInvalid();
      else if(key==='authExpired'||key==='authForbidden'){changed(null);setEpoch(value=>value+1);setError(key);}
      else{setError(key);if(kind==='accept'&&key==='guardianUnavailable'){setUncertain(true);setError('guardianUncertain');}}
    }}finally{if(request.current===controller){request.current=null;if(!controller.signal.aborted)setPending(null);}}
  }
  return <div className="space-y-5" aria-busy={pending!==null}>
    <p>{t('guardianIntro')}</p><fieldset disabled={pending!==null}><AccountAccess key={epoch} api={api} labels={labels} onAccountChange={changed}/></fieldset>
    {!account?<p className="text-sm text-muted-foreground">{t('familySignInHint')}</p>:!account.roles.includes('customer')?<p role="alert">{t('guardianCustomerRequired')}</p>:<>
      {preview&&<div className="space-y-2 border-l-4 border-primary pl-4"><h2 className="break-words text-xl font-semibold">{preview.dependent.fullName}</h2><p className="text-sm">{t('familyExpires')}: <time dateTime={preview.expiresAt}>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(preview.expiresAt))}</time></p></div>}
      <Button className="min-h-11 w-full whitespace-normal" disabled={pending!==null||uncertain} onClick={()=>void act(preview?'accept':'preview')}>{t(pending==='accept'?'familyAccepting':pending==='preview'?'familyReviewing':preview?'guardianAccept':'guardianReview')}</Button>
    </>}
    <p className="text-sm text-muted-foreground">{t('guardianNoOtherAccess')}</p>{error&&<p role="alert" className="text-sm text-destructive">{t(error)}</p>}
  </div>;
}
