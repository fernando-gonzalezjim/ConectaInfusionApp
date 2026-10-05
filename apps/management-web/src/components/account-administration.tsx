import {useEffect,useId,useRef,useState,type FormEvent} from 'react';
import type {AccountListQuery,AccountListResponse,AccountProfile,AccountProfileInput,IdentityRole,RoleChangeInput,RoleChangeResponse} from '@conecta/contracts';
import {Button} from '@conecta/ui/components/button';
import {Input} from '@conecta/ui/components/input';
import {ProfilePhoto} from '@conecta/ui/components/profile-photo';
import {Dialog,DialogTrigger,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@conecta/ui/components/dialog';
import type {useLocale} from '@conecta/i18n';
import {GuardianAccess,type GuardianApi} from '@conecta/ui/components/guardian-access';
import {FamilyAccess,type FamilyApi} from '@conecta/ui/components/family-access';

const roles:IdentityRole[]=['administrator','manager','reception','cafe_staff','instructor','customer'];
type Text=ReturnType<typeof useLocale>['t'];
type Key=Parameters<Text>[0];
interface AdministrationApi extends FamilyApi,GuardianApi {
  getAccountPhoto(id:string,signal?:AbortSignal):Promise<Blob>;
  uploadAccountPhoto(id:string,input:import('@conecta/contracts').PhotoUploadInput,signal?:AbortSignal):Promise<AccountProfile>;
  listAccounts(query?:AccountListQuery,signal?:AbortSignal):Promise<AccountListResponse>;
  updateAccountProfile(id:string,input:AccountProfileInput,signal?:AbortSignal):Promise<AccountProfile>;
  changeAccountRoles(id:string,input:RoleChangeInput,signal?:AbortSignal):Promise<RoleChangeResponse>;
}
type AccessLost=(code:'UNAUTHENTICATED'|'FORBIDDEN')=>void;
function errorKey(error:unknown):Key {
  const code=error instanceof Error&&'code' in error?error.code:null;
  return code==='CONFLICT'?'rolesConflict':code==='NOT_FOUND'?'accountNotFound':code==='INVALID_REQUEST'?'profileInvalid'
    :code==='THROTTLED'?'authThrottled':code==='UNAUTHENTICATED'?'authExpired':code==='FORBIDDEN'?'managementDenied':'administrationUnavailable';
}
function accessFailure(error:unknown,onAccessLost:AccessLost){
  if(error instanceof Error&&'code' in error&&(error.code==='UNAUTHENTICATED'||error.code==='FORBIDDEN'))onAccessLost(error.code);
}

function AccountEditor({record,actorId,api,t,onSaved,onAccessLost}: {
  record:AccountProfile;actorId:string;api:AdministrationApi;t:Text;onSaved:(record:AccountProfile)=>void;onAccessLost:AccessLost;
}) {
  const id=useId();const [open,setOpen]=useState(false);const [name,setName]=useState(record.fullName);const [phone,setPhone]=useState(record.phone??'');
  const [locale,setLocale]=useState(record.preferredLocale);const [selected,setSelected]=useState(record.roles);
  const [pending,setPending]=useState<'profile'|'roles'|'photo'|null>(null);const [error,setError]=useState<Key|null>(null);const [message,setMessage]=useState<Key|null>(null);
  const photoBusy=useRef(false);
  const request=useRef<AbortController|null>(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  function changeOpen(value:boolean){
    // Cancelling a browser response cannot undo an already committed POST.
    if(request.current||photoBusy.current)return;
    setOpen(value);setPending(null);setError(null);setMessage(null);setName(record.fullName);setPhone(record.phone??'');setLocale(record.preferredLocale);setSelected(record.roles);
  }
  async function save(event:FormEvent,kind:'profile'|'roles') {
    event.preventDefault();if(request.current||photoBusy.current)return;
    const controller=new AbortController();request.current=controller;setPending(kind);setError(null);setMessage(null);
    try {
      if(kind==='profile'){
        const result=await api.updateAccountProfile(record.id,{fullName:name,phone:phone||null,preferredLocale:locale},controller.signal);
        if(!controller.signal.aborted){onSaved(result);setName(result.fullName);setPhone(result.phone??'');setLocale(result.preferredLocale);setMessage('profileSaved');}
      }else{
        const result=await api.changeAccountRoles(record.id,{roles:selected},controller.signal);
        if(!controller.signal.aborted){onSaved({...record,roles:result.roles});setSelected(result.roles);setMessage('rolesSaved');
          // Only an actual change revokes sessions; an identical assignment is a no-op.
          if(record.id===actorId&&JSON.stringify([...record.roles].sort())!==JSON.stringify([...result.roles].sort()))onAccessLost('UNAUTHENTICATED');}
      }
    }catch(failure){if(!controller.signal.aborted){setError(errorKey(failure));accessFailure(failure,onAccessLost);}}
    finally{if(request.current===controller){request.current=null;if(!controller.signal.aborted)setPending(null);}}
  }
  const rolesAllowed=record.status==='active'&&record.profileStatus==='active';
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button variant="outline" className="min-h-11 whitespace-normal" aria-label={`${t('viewAccount')}: ${record.fullName}`}>{t('viewAccount')}</Button></DialogTrigger>
    <DialogContent closeLabel={t('close')} closeDisabled={pending!==null} onEscapeKeyDown={event=>{if(request.current||photoBusy.current)event.preventDefault();}} onInteractOutside={event=>{if(request.current||photoBusy.current)event.preventDefault();}} className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
      <DialogHeader><DialogTitle>{t('accountDetails')}</DialogTitle><DialogDescription>{t('accountDetailsIntro')}</DialogDescription></DialogHeader>
      <ProfilePhoto photoId={record.photoId} read={signal=>api.getAccountPhoto(record.id,signal)} upload={(input,signal)=>api.uploadAccountPhoto(record.id,input,signal)} t={t}
        disabled={pending!==null} onPending={value=>{photoBusy.current=value;setPending(value?'photo':null);}} onSaved={onSaved} onAccessLost={value=>accessFailure(value,onAccessLost)} />
      <dl className="space-y-1 break-words text-sm"><dt className="font-medium">{t('email')}</dt><dd>{record.email}</dd><dt className="font-medium">{t('accountStatus')}</dt><dd>{t(record.status)}</dd><dt className="font-medium">{t('confirmationStatus')}</dt><dd>{t(record.confirmationStatus==='pending'?'confirmationPendingStatus':record.confirmationStatus)}</dd></dl>
      <form onSubmit={e=>void save(e,'profile')} className="space-y-4" aria-busy={pending==='profile'}>
        <fieldset disabled={pending!==null} className="space-y-3"><legend className="mb-3 font-semibold">{t('personalDetails')}</legend>
          <div><label htmlFor={id+'-name'} className="mb-2 block text-sm font-medium">{t('fullName')}</label><Input id={id+'-name'} autoFocus required maxLength={120} value={name} onChange={e=>setName(e.target.value)} /></div>
          <div><label htmlFor={id+'-phone'} className="mb-2 block text-sm font-medium">{t('phoneOptional')}</label><Input id={id+'-phone'} type="tel" maxLength={40} value={phone} onChange={e=>setPhone(e.target.value)} /></div>
          <div><label htmlFor={id+'-locale'} className="mb-2 block text-sm font-medium">{t('preferredLanguage')}</label><select id={id+'-locale'} className="w-full rounded-md border bg-background p-3" value={locale} onChange={e=>setLocale(e.target.value as AccountProfile['preferredLocale'])}><option value="es-MX">Español</option><option value="en">English</option></select></div>
          <Button type="submit" disabled={!name.trim()} className="min-h-11 w-full">{t(pending==='profile'?'savingChanges':'saveProfile')}</Button>
        </fieldset>
      </form>
      <form onSubmit={e=>void save(e,'roles')} className="space-y-3" aria-busy={pending==='roles'}>
        <fieldset disabled={pending!==null||!rolesAllowed} className="space-y-3"><legend className="mb-2 font-semibold">{t('accountRoles')}</legend>
          {roles.map(role=><label key={role} className="flex min-h-11 items-center gap-3"><input type="checkbox" className="size-5 shrink-0" checked={selected.includes(role)} disabled={role==='customer'&&record.roles.includes('customer')} onChange={e=>setSelected(previous=>roles.filter(item=>item===role?e.target.checked:previous.includes(item)))} /><span>{t(role)}</span></label>)}
          <Button type="submit" disabled={selected.length===0} className="min-h-11 w-full">{t(pending==='roles'?'savingChanges':'saveRoles')}</Button>
        </fieldset>
        <p className="text-sm text-muted-foreground">{t(rolesAllowed?'roleChangeHint':'inactiveRolesHint')}</p>
        {record.roles.includes('customer')&&<p className="text-sm text-muted-foreground">{t('customerRoleRetained')}</p>}
      </form>
      {message&&<p role="status" className="text-sm">{t(message)}</p>}
      {error&&<p role="alert" className="text-sm text-destructive">{t(error)}</p>}
    </DialogContent>
  </Dialog>;
}

export function AccountAdministration({api,actorId,t,onAccessLost}: {api:AdministrationApi;actorId:string;t:Text;onAccessLost:AccessLost}) {
  const id=useId();const [role,setRole]=useState<IdentityRole|''>('');const [status,setStatus]=useState<AccountProfile['status']|''>('');
  const [cursors,setCursors]=useState<(string|undefined)[]>([undefined]);const [records,setRecords]=useState<AccountProfile[]>([]);const [next,setNext]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);const [error,setError]=useState<Key|null>(null);const [attempt,setAttempt]=useState(0);
  const cursor=cursors[cursors.length-1];
  useEffect(()=>{
    const controller=new AbortController();setRecords([]);setNext(null);setLoading(true);setError(null);
    api.listAccounts({limit:25,cursor,...(role?{role}:{}),...(status?{status}:{})},controller.signal).then(result=>{if(!controller.signal.aborted){setRecords(result.accounts);setNext(result.nextCursor);}})
      .catch(failure=>{if(!controller.signal.aborted){setError(errorKey(failure));accessFailure(failure,onAccessLost);}})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[api,cursor,role,status,attempt,onAccessLost]);
  return <section aria-labelledby={id+'-heading'} className="rounded-xl border bg-white p-4 sm:p-6">
    <h2 id={id+'-heading'} className="text-xl font-semibold">{t('managementAccessTitle')}</h2><p className="mt-2 text-sm text-muted-foreground">{t('administrationIntro')}</p>
    <div className="my-5 flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1"><label htmlFor={id+'-role'} className="mb-2 block text-sm font-medium">{t('filterRole')}</label><select id={id+'-role'} className="w-full rounded-md border bg-background p-3" value={role} onChange={e=>{setRole(e.target.value as IdentityRole|'');setCursors([undefined]);}}><option value="">{t('allRoles')}</option>{roles.map(role=><option key={role} value={role}>{t(role)}</option>)}</select></div>
      <div className="min-w-0 flex-1"><label htmlFor={id+'-status'} className="mb-2 block text-sm font-medium">{t('filterStatus')}</label><select id={id+'-status'} className="w-full rounded-md border bg-background p-3" value={status} onChange={e=>{setStatus(e.target.value as AccountProfile['status']|'');setCursors([undefined]);}}><option value="">{t('allStatuses')}</option>{(['pending','active','inactive'] as const).map(status=><option key={status} value={status}>{t(status)}</option>)}</select></div>
      <Button variant="outline" className="min-h-11" disabled={loading} onClick={()=>setAttempt(value=>value+1)}>{t('refreshAccounts')}</Button>
    </div>
    {loading&&<p role="status">{t('accountsLoading')}</p>}
    {error&&<div className="space-y-3"><p role="alert" className="text-sm text-destructive">{t(error)}</p><Button onClick={()=>setAttempt(value=>value+1)}>{t('retry')}</Button></div>}
    {!loading&&!error&&records.length===0&&<p>{t('noAccounts')}</p>}
    <ul className="space-y-3">{records.map(record=><li key={record.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"><div className="min-w-0 flex-1 break-words"><h3 className="font-semibold">{record.fullName}</h3><p className="text-sm text-muted-foreground">{record.email}</p><p className="mt-2 text-sm">{t(record.status)} · {record.roles.map(role=>t(role)).join(', ')}</p></div>
      {record.roles.includes('customer')&&record.status==='active'&&record.profileStatus==='active'&&<GuardianAccess api={api} accountId={record.id} t={t} onAccessLost={onAccessLost}/>}
      {record.roles.includes('customer')&&record.status==='active'&&record.profileStatus==='active'&&<FamilyAccess api={api} account={record} management t={t} onAccessLost={onAccessLost} />}
      <AccountEditor api={api} record={record} actorId={actorId} t={t} onAccessLost={onAccessLost} onSaved={updated=>setRecords(current=>current.map(row=>row.id===updated.id?updated:row))} /></li>)}</ul>
    {!loading&&!error&&<nav aria-label={t('accountPages')} className="mt-5 flex flex-wrap items-center gap-3"><Button variant="outline" disabled={cursors.length===1} onClick={()=>setCursors(previous=>previous.slice(0,-1))}>{t('previousPage')}</Button><span className="text-sm">{t('pageNumber')} {cursors.length}</span><Button variant="outline" disabled={!next} onClick={()=>{if(next)setCursors(previous=>[...previous,next]);}}>{t('nextPage')}</Button></nav>}
  </section>;
}
