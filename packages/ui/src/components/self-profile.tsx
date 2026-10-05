import {useEffect,useRef,useState} from 'react';
import type {AccountProfile,AccountProfileInput,ActionAcceptedResponse,PublicAccount} from '@conecta/contracts';
import {Button} from './button';
import {Input} from './input';
import {ProfilePhoto,type PhotoKey} from './profile-photo';
export type ProfileKey='editMyProfile'|'profileLoading'|'fullName'|'phoneOptional'|'preferredLanguage'|'saveProfile'|'profileSaved'|'newEmail'|'sendEmailChange'|'emailChangeIntro'|'emailChangeSent'|'recentAuthRequired'|'emailChangeConflict'|'profileUnavailable'|'authExpired'|'authForbidden'|'authThrottled'|'profileInvalid'|'retry';
export interface ProfileApi {
  getOwnPhoto(signal?:AbortSignal):Promise<Blob>;
  uploadOwnPhoto(input:import('@conecta/contracts').PhotoUploadInput,signal?:AbortSignal):Promise<AccountProfile>;
  getOwnProfile(signal?:AbortSignal):Promise<AccountProfile>;
  updateOwnProfile(input:AccountProfileInput,signal?:AbortSignal):Promise<AccountProfile>;
  requestEmailChange(input:{email:string},signal?:AbortSignal):Promise<ActionAcceptedResponse>;
}
export function SelfProfile({api,account,t,onSaved,onPending,onAccessLost}:{api:ProfileApi;account:PublicAccount;t:(key:ProfileKey|PhotoKey)=>string;
  onSaved:(account:PublicAccount)=>void;onPending:(pending:boolean)=>void;onAccessLost:()=>void}){
  const [editing,setEditing]=useState(false),[profile,setProfile]=useState<AccountProfile|null>(null),[attempt,setAttempt]=useState(0);
  const [name,setName]=useState(''),[phone,setPhone]=useState(''),[locale,setLocale]=useState<'es-MX'|'en'>('es-MX'),[email,setEmail]=useState('');
  const [pending,setPending]=useState(false),[message,setMessage]=useState<ProfileKey|null>(null),[error,setError]=useState<ProfileKey|null>(null);
  const request=useRef<AbortController|null>(null),busy=useRef(false);
  // Keep callbacks current without restarting reads when parent state changes.
  const callbacks=useRef({onSaved,onPending,onAccessLost});callbacks.current={onSaved,onPending,onAccessLost};
  const failure=(value:unknown)=>{
    const code=value instanceof Error&&'code' in value?value.code:'';
    if(code==='UNAUTHENTICATED'){callbacks.current.onAccessLost();return;}
    setError(code==='RECENT_AUTH_REQUIRED'?'recentAuthRequired':code==='CONFLICT'?'emailChangeConflict':code==='FORBIDDEN'?'authForbidden'
      :code==='THROTTLED'?'authThrottled':code==='INVALID_REQUEST'?'profileInvalid':'profileUnavailable');
  };
  useEffect(()=>{
    if(!editing)return;
    const controller=new AbortController();request.current=controller;setProfile(null);setError(null);
    api.getOwnProfile(controller.signal).then(value=>{
      if(controller.signal.aborted)return;
      if(value.id!==account.id)throw new Error('PROFILE_TARGET_MISMATCH');
      setProfile(value);setName(value.fullName);setPhone(value.phone??'');setLocale(value.preferredLocale);
    }).catch(value=>{if(!controller.signal.aborted)failure(value);});
    return()=>controller.abort();
  },[api,account.id,editing,attempt]);
  useEffect(()=>()=>{request.current?.abort();callbacks.current.onPending(false);},[]);
  async function save(kind:'profile'|'email'){
    if(busy.current||!profile)return;busy.current=true;setPending(true);callbacks.current.onPending(true);setError(null);setMessage(null);
    const controller=new AbortController();request.current=controller;
    try{
      if(kind==='profile'){
        const next=await api.updateOwnProfile({fullName:name,phone:phone||null,preferredLocale:locale},controller.signal);
        if(!controller.signal.aborted){setProfile(next);setName(next.fullName);setPhone(next.phone??'');setLocale(next.preferredLocale);callbacks.current.onSaved(next);setMessage('profileSaved');}
      }else{
        await api.requestEmailChange({email},controller.signal);
        if(!controller.signal.aborted){setEmail('');setMessage('emailChangeSent');}
      }
    }catch(value){if(!controller.signal.aborted)failure(value);}
    finally{busy.current=false;callbacks.current.onPending(false);if(!controller.signal.aborted)setPending(false);}
  }
  if(!editing)return <Button variant="outline" className="min-h-11" onClick={()=>setEditing(true)}>{t('editMyProfile')}</Button>;
  return <div className="space-y-5" aria-busy={pending}>
    {error&&<p role="alert" className="text-sm text-destructive">{t(error)}</p>}
    {message&&<p role="status" className="text-sm">{t(message)}</p>}
    {!profile?error?<Button variant="outline" onClick={()=>setAttempt(value=>value+1)}>{t('retry')}</Button>:<p role="status">{t('profileLoading')}</p>:<>
      <ProfilePhoto photoId={profile.photoId} read={signal=>api.getOwnPhoto(signal)} upload={(input,signal)=>api.uploadOwnPhoto(input,signal)} t={t}
        disabled={pending} onPending={value=>{busy.current=value;setPending(value);callbacks.current.onPending(value);}}
        onSaved={value=>{setProfile(value);callbacks.current.onSaved(value);}} onAccessLost={value=>{if(value instanceof Error&&'code' in value&&value.code==='UNAUTHENTICATED')callbacks.current.onAccessLost();}} />
      <form className="space-y-3" onSubmit={event=>{event.preventDefault();void save('profile');}}>
        <fieldset disabled={pending} className="space-y-3"><legend className="mb-3 font-medium">{t('editMyProfile')}</legend>
          <label className="block text-sm">{t('fullName')}<Input autoFocus className="mt-1" required maxLength={120} value={name} onChange={event=>setName(event.target.value)} /></label>
          <label className="block text-sm">{t('phoneOptional')}<Input className="mt-1" type="tel" maxLength={40} value={phone} onChange={event=>setPhone(event.target.value)} /></label>
          <label className="block text-sm">{t('preferredLanguage')}<select className="mt-1 block min-h-11 w-full rounded-md border bg-background p-2" value={locale} onChange={event=>setLocale(event.target.value as 'es-MX'|'en')}><option value="es-MX">Español</option><option value="en">English</option></select></label>
          <Button type="submit" className="min-h-11">{t('saveProfile')}</Button></fieldset>
      </form>
      <form className="space-y-3 border-t pt-4" onSubmit={event=>{event.preventDefault();void save('email');}}>
        <p className="text-sm text-muted-foreground">{t('emailChangeIntro')}</p>
        <fieldset disabled={pending} className="space-y-3"><legend className="sr-only">{t('newEmail')}</legend>
          <label className="block text-sm">{t('newEmail')}<Input className="mt-1" type="email" autoComplete="email" required maxLength={320} value={email} onChange={event=>setEmail(event.target.value)} /></label>
          <Button type="submit" className="min-h-11">{t('sendEmailChange')}</Button></fieldset>
      </form>
    </>}
  </div>;
}
