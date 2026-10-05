import {useCallback,useEffect,useRef,useState} from 'react';
import type {PublicAccount,FamilyInvitationPreview,Locale,LoginInput,LoginResponse,SessionResponse} from '@conecta/contracts';
import {AccountAccess,type AccountLabels} from './account-access';
import {Button} from './button';
import {familyError,type FamilyApi,type FamilyKey,type FamilyText} from './family-access';
interface InvitationApi extends FamilyApi {
  getSession(signal?:AbortSignal):Promise<SessionResponse>;login(input:LoginInput,signal?:AbortSignal):Promise<LoginResponse>;
  logout(signal?:AbortSignal):Promise<void>;logoutAll(signal?:AbortSignal):Promise<void>;
}
export function FamilyInvitation({api,token,t,locale,labels,onCompleted,onInvalid,purpose='membership'}:{
  api:InvitationApi;token:string;t:FamilyText;locale:Locale;labels:AccountLabels;onCompleted:(decision?:'declined')=>void;onInvalid:()=>void;purpose?:'membership'|'responsibility';
}){
  const [account,setAccount]=useState<PublicAccount|null>(null),[epoch,setEpoch]=useState(0),[preview,setPreview]=useState<FamilyInvitationPreview|null>(null);
  const successor=purpose==='responsibility';
  const [pending,setPending]=useState<'preview'|'accept'|'decline'|null>(null),[error,setError]=useState<FamilyKey|null>(null),[uncertain,setUncertain]=useState(false);
  const request=useRef<AbortController|null>(null),identity=useRef<string|null>(null);
  const changed=useCallback((next:PublicAccount|null)=>{
    const key=next?JSON.stringify([next.id,next.email,[...next.roles].sort()]):null;if(identity.current===key)return;identity.current=key;
    request.current?.abort();request.current=null;setAccount(next);setPreview(null);setPending(null);setError(null);setUncertain(false);
  },[]);
  useEffect(()=>()=>request.current?.abort(),[]);
  async function act(kind:'preview'|'accept'|'decline'){
    if(request.current||!account||uncertain)return;const controller=new AbortController();request.current=controller;setPending(kind);setError(null);
    try{
      if(kind==='preview'){const result=await (successor?api.previewFamilySuccessor:api.previewFamilyInvitation)({token},controller.signal);if(!controller.signal.aborted)setPreview(result);}
      else {await (kind==='decline'?api.declineFamilySuccessor:successor?api.acceptFamilySuccessor:api.acceptFamilyInvitation)({token},controller.signal);if(!controller.signal.aborted)onCompleted(kind==='decline'?'declined':undefined);}
    }catch(error){if(!controller.signal.aborted){const key=familyError(error);
      if(key==='familyInvalid')onInvalid();
      else if(key==='authExpired'||key==='familyForbidden'){changed(null);setEpoch(value=>value+1);setError(key);}
      else {setError(key);if(kind!=='preview'&&key==='familyUnavailable'){setUncertain(true);setError('familyUncertain');}}
    }}finally{if(request.current===controller){request.current=null;if(!controller.signal.aborted)setPending(null);}}
  }
  return <div className="space-y-5" aria-busy={pending!==null}>
    <p>{t(successor?'successorIntro':'familyInvitationIntro')}</p>
    <fieldset disabled={pending!==null}><AccountAccess key={epoch} api={api} labels={labels} onAccountChange={changed} /></fieldset>
    {!account?<p className="text-sm text-muted-foreground">{t('familySignInHint')}</p>:!account.roles.includes('customer')?<p role="alert">{t('familyCustomerRequired')}</p>:<>
      {preview&&<div className="space-y-2 border-l-4 border-primary pl-4"><h2 className="break-words text-xl font-semibold">{preview.family.name}</h2>
        <p className="text-sm">{t('familyExpires')}: <time dateTime={preview.expiresAt}>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(preview.expiresAt))}</time></p>
      </div>}
      {!preview?<Button className="min-h-11 w-full" disabled={pending!==null} onClick={()=>void act('preview')}>{t(pending?'familyReviewing':'familyReview')}</Button>
        :<div className="space-y-3"><Button className="min-h-11 w-full" disabled={pending!==null||uncertain} onClick={()=>void act('accept')}>{t(pending==='accept'?'familyAccepting':successor?'successorAccept':'familyAccept')}</Button>
          {successor&&<Button variant="outline" className="min-h-11 w-full" disabled={pending!==null||uncertain} onClick={()=>void act('decline')}>{t(pending==='decline'?'successorDeclining':'successorDecline')}</Button>}
        </div>}
    </>}
    <p className="text-sm text-muted-foreground">{t(successor?'successorNoFinancialChange':'familyNoGuardianship')}</p>
    {error&&<p role="alert" className="text-sm text-destructive">{t(error)}</p>}
  </div>;
}
