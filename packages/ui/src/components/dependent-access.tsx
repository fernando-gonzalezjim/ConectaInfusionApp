import {useEffect,useId,useRef,useState,type FormEvent} from 'react';
import type {DependentProfileView,SavedChildView,DependentProfileInput,SavedChildInput,IdentityPage,PublicAccount,Locale} from '@conecta/contracts';
import {GuardianAccess,type GuardianApi,type GuardianKey} from './guardian-access';
import {GuardianRemoval} from './guardian-removal';
import {Button} from './button';
import {Input} from './input';
import {Dialog,DialogTrigger,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './dialog';
type Query={limit?:number;cursor?:string};
export interface DependentApi extends GuardianApi {
  listDependents(query?:Query,signal?:AbortSignal):Promise<IdentityPage<DependentProfileView>>;
  listChildDetails(query?:Query,signal?:AbortSignal):Promise<IdentityPage<SavedChildView>>;
  createDependent(input:DependentProfileInput,signal?:AbortSignal):Promise<DependentProfileView>;
  updateDependent(id:string,input:DependentProfileInput&{expectedVersion:number},signal?:AbortSignal):Promise<DependentProfileView>;
  createChildDetails(input:SavedChildInput,signal?:AbortSignal):Promise<SavedChildView>;
  updateChildDetails(id:string,input:SavedChildInput&{expectedVersion:number},signal?:AbortSignal):Promise<SavedChildView>;
  convertChildDetails(id:string,input:{expectedVersion:number},signal?:AbortSignal):Promise<{child:SavedChildView;dependent:DependentProfileView}>;
}
export type DependentKey=GuardianKey|'childrenTitle'|'childrenIntro'|'childrenSaved'|'childrenProfiles'|'childrenName'|'childrenAge'|'childrenAgeHint'|'childrenAddSaved'|'childrenAddProfile'|'childrenSave'|'childrenSaveProfile'|'childrenEditSaved'|'childrenEditProfile'|'childrenConvert'|'childrenConvertConfirm'|'childrenConvertHint'|'childrenLinked'|'childrenGuardians'|'childrenEmptySaved'|'childrenEmptyProfiles'|'childrenLoading'|'childrenSaving'|'childrenSavedMessage'|'childrenConverted'|'childrenUnavailable'|'childrenUncertain'|'childrenConflict'|'childrenMissing'|'childrenInvalid'|'childrenRefresh'|'childrenPrevious'|'childrenNext'|'childrenCancel'|'childrenNoBookings'|'childrenNoLogin'|'childrenNoGuardianship'|'childrenLinkedHint'|'childrenLocale'|'authExpired'|'authForbidden'|'authThrottled'|'close';
type Text=(key:DependentKey)=>string;
type Row=SavedChildView|DependentProfileView;
const name=(row:Row)=>'childName' in row?row.childName:row.fullName;
export function DependentAccess({api,account,t,onAccessLost}:{api:DependentApi;account:PublicAccount;t:Text;onAccessLost:(code:'UNAUTHENTICATED'|'FORBIDDEN')=>void}){
  const [open,setOpen]=useState(false),[pending,setPending]=useState(false);
  return <Dialog open={open} onOpenChange={value=>{if(!pending)setOpen(value);}}>
    <DialogTrigger asChild><Button variant="outline" className="min-h-11 whitespace-normal">{t('childrenTitle')}</Button></DialogTrigger>
    <DialogContent closeLabel={t('close')} closeDisabled={pending} onEscapeKeyDown={e=>{if(pending)e.preventDefault();}} onInteractOutside={e=>{if(pending)e.preventDefault();}}
      className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
      <DialogHeader><DialogTitle>{t('childrenTitle')}</DialogTitle><DialogDescription>{t('childrenIntro')}</DialogDescription></DialogHeader>
      <DependentPanel api={api} account={account} t={t} onPending={setPending} onAccessLost={onAccessLost}/>
    </DialogContent>
  </Dialog>;
}
function DependentPanel({api,account,t,onPending,onAccessLost}:{api:DependentApi;account:PublicAccount;t:Text;onPending:(value:boolean)=>void;onAccessLost:(code:'UNAUTHENTICATED'|'FORBIDDEN')=>void}){
  const id=useId(),request=useRef<AbortController|null>(null);
  const [view,setView]=useState<'saved'|'profiles'>('saved'),[cursors,setCursors]=useState<(string|undefined)[]>([undefined]),[attempt,setAttempt]=useState(0);
  const [data,setData]=useState<IdentityPage<Row>|null>(null),[loading,setLoading]=useState(true),[pending,setPending]=useState(false),[uncertain,setUncertain]=useState(false);
  const [error,setError]=useState<DependentKey|null>(null),[message,setMessage]=useState<DependentKey|null>(null);
  const [form,setForm]=useState<'createSaved'|'createProfile'|'edit'|'convert'|null>(null),[selected,setSelected]=useState<Row|null>(null);
  const [fullName,setName]=useState(''),[ageText,setAge]=useState(''),[locale,setLocale]=useState<Locale>(account.preferredLocale);
  const cursor=cursors.at(-1);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setData(null);setError(null);
    (view==='saved'?api.listChildDetails({limit:10,cursor},controller.signal):api.listDependents({limit:10,cursor},controller.signal))
      .then(value=>{if(!controller.signal.aborted){setData(value);setUncertain(false);}})
      .catch(reason=>{if(!controller.signal.aborted){const code=reason instanceof Error&&'code' in reason?reason.code:null;setError(code==='UNAUTHENTICATED'?'authExpired':code==='FORBIDDEN'?'authForbidden':'childrenUnavailable');if(code==='UNAUTHENTICATED'||code==='FORBIDDEN')onAccessLost(code);}})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[api,view,cursor,attempt,onAccessLost]);
  useEffect(()=>()=>request.current?.abort(),[]);
  function edit(action:NonNullable<typeof form>,row:Row|null=null){setForm(action);setSelected(row);setName(row?name(row):'');setAge(row?.ageText??'');setLocale(row&&'preferredLocale' in row?row.preferredLocale:account.preferredLocale);setError(null);setMessage(null);}
  function refresh(){setForm(null);setSelected(null);setMessage(null);setAttempt(value=>value+1);}
  async function submit(event:FormEvent){
    event.preventDefault();if(request.current||uncertain||!data||!form)return;
    const controller=new AbortController();request.current=controller;setPending(true);onPending(true);setError(null);setMessage(null);
    try{
      const input={fullName:fullName.trim(),ageText:ageText.trim(),preferredLocale:locale};
      if(form==='createSaved')await api.createChildDetails({childName:input.fullName,ageText:input.ageText},controller.signal);
      else if(form==='createProfile')await api.createDependent(input,controller.signal);
      else if(form==='edit'&&selected){
        if('childName' in selected)await api.updateChildDetails(selected.id,{childName:input.fullName,ageText:input.ageText,expectedVersion:selected.version},controller.signal);
        else await api.updateDependent(selected.id,{...input,expectedVersion:selected.version},controller.signal);
      }else if(form==='convert'&&selected&&'childName' in selected)await api.convertChildDetails(selected.id,{expectedVersion:selected.version},controller.signal);
      if(!controller.signal.aborted){setMessage(form==='convert'?'childrenConverted':'childrenSavedMessage');setForm(null);setSelected(null);setAttempt(value=>value+1);}
    }catch(reason){if(!controller.signal.aborted){
      const code=reason instanceof Error&&'code' in reason?reason.code:null;
      setError(code==='UNAUTHENTICATED'?'authExpired':code==='FORBIDDEN'?'authForbidden':code==='NOT_FOUND'?'childrenMissing':code==='CONFLICT'?'childrenConflict':code==='INVALID_REQUEST'?'childrenInvalid':code==='THROTTLED'?'authThrottled':'childrenUncertain');
      if(code==='UNAUTHENTICATED'||code==='FORBIDDEN')onAccessLost(code);
      if(!['INVALID_REQUEST','THROTTLED','UNAUTHENTICATED','FORBIDDEN'].includes(String(code)))setUncertain(true);
      if(code==='NOT_FOUND'){setData(null);setForm(null);setSelected(null);}
    }}finally{if(request.current===controller){request.current=null;if(!controller.signal.aborted){setPending(false);onPending(false);}}}
  }
  const disabled=pending||loading||uncertain;
  return <div className="space-y-5" aria-busy={loading||pending}>
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('childrenTitle')}>
      {(['saved','profiles'] as const).map(kind=><Button key={kind} variant={view===kind?'default':'outline'} aria-pressed={view===kind} disabled={pending||uncertain} className="min-h-11 whitespace-normal" onClick={()=>{setView(kind);setCursors([undefined]);setForm(null);setSelected(null);setMessage(null);}}>{t(kind==='saved'?'childrenSaved':'childrenProfiles')}</Button>)}
    </div>
    <h3 className="text-lg font-semibold">{t(view==='saved'?'childrenSaved':'childrenProfiles')}</h3>
    <p className="text-sm text-muted-foreground">{t(view==='saved'?'childrenIntro':'childrenNoLogin')}</p>
    {loading?<p role="status">{t('childrenLoading')}</p>:data&&<>
      {!form?<><Button disabled={disabled} className="min-h-11 w-full whitespace-normal" onClick={()=>edit(view==='saved'?'createSaved':'createProfile')}>{t(view==='saved'?'childrenAddSaved':'childrenAddProfile')}</Button>
        {data.items.length===0?<p>{t(view==='saved'?'childrenEmptySaved':'childrenEmptyProfiles')}</p>:<ul className="divide-y">{data.items.map(row=><li key={row.id} className="space-y-2 py-4">
          <h4 className="break-words font-semibold">{name(row)}</h4><p className="break-words text-sm">{t('childrenAge')}: {row.ageText}</p>
          {'guardians' in row&&<><h5 className="text-sm font-medium">{t('childrenGuardians')}</h5><ul className="list-inside list-disc text-sm">{row.guardians.map(guardian=><li className="break-words" key={guardian.accountId}>{guardian.fullName}</li>)}</ul></>}
          {'childName' in row&&row.dependentPersonId&&<p className="text-sm text-muted-foreground">{t('childrenLinked')}</p>}
          <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={disabled} className="min-h-11 whitespace-normal" aria-label={`${t('childName' in row?'childrenEditSaved':'childrenEditProfile')}: ${name(row)}`} onClick={()=>edit('edit',row)}>{t('childName' in row?'childrenEditSaved':'childrenEditProfile')}</Button>
            {'guardians' in row&&<GuardianAccess api={api} t={t} dependent={row} onAccessLost={onAccessLost}/>}
            {'guardians' in row&&<GuardianRemoval api={api} t={t} dependent={row} onAccessLost={onAccessLost} onRemoved={()=>{setData(null);setSelected(null);setForm(null);setMessage('guardianRemoved');setCursors([undefined]);setAttempt(value=>value+1);}}/>}
            {'childName' in row&&row.dependentPersonId===null&&<Button variant="outline" disabled={disabled} className="min-h-11 whitespace-normal" aria-label={`${t('childrenConvert')}: ${name(row)}`} onClick={()=>edit('convert',row)}>{t('childrenConvert')}</Button>}
          </div></li>)}</ul>}
        <nav className="flex flex-wrap gap-2" aria-label={t('childrenTitle')}><Button variant="outline" className="min-h-11" disabled={disabled||cursors.length===1} onClick={()=>setCursors(value=>value.slice(0,-1))}>{t('childrenPrevious')}</Button><Button variant="outline" className="min-h-11" disabled={disabled||!data.nextCursor} onClick={()=>setCursors(value=>[...value,data.nextCursor!])}>{t('childrenNext')}</Button></nav>
      </>:<form onSubmit={event=>void submit(event)} className="space-y-3"><fieldset disabled={disabled} className="space-y-3">
        {form==='convert'?<><h4 className="break-words font-semibold">{selected&&name(selected)}</h4><p>{t('childrenConvertHint')}</p></>:<>
          <label htmlFor={id+'-name'} className="block text-sm font-medium">{t('childrenName')}</label><Input id={id+'-name'} autoFocus required maxLength={120} value={fullName} onChange={e=>setName(e.target.value)}/>
          <label htmlFor={id+'-age'} className="block text-sm font-medium">{t('childrenAge')}</label><Input id={id+'-age'} aria-describedby={id+'-age-hint'} required maxLength={40} value={ageText} onChange={e=>setAge(e.target.value)}/><p id={id+'-age-hint'} className="text-sm text-muted-foreground">{t('childrenAgeHint')}</p>
          {(form==='createProfile'||selected&&'preferredLocale' in selected)&&<><label htmlFor={id+'-locale'} className="block text-sm font-medium">{t('childrenLocale')}</label><select id={id+'-locale'} className="min-h-11 w-full rounded-md border bg-background px-3" value={locale} onChange={e=>setLocale(e.target.value as Locale)}><option value="es-MX">Español</option><option value="en">English</option></select></>}
          {selected&&'childName' in selected&&selected.dependentPersonId&&<p className="text-sm">{t('childrenLinkedHint')}</p>}
        </>}
        <Button type="submit" disabled={!fullName.trim()||!ageText.trim()} className="min-h-11 w-full whitespace-normal">{t(pending?'childrenSaving':form==='convert'?'childrenConvertConfirm':form==='createProfile'||selected&&'preferredLocale' in selected?'childrenSaveProfile':'childrenSave')}</Button>
      </fieldset><Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={()=>{setForm(null);setSelected(null);setError(null);}}>{t('childrenCancel')}</Button></form>}
    </>}
    <Button variant="outline" className="min-h-11" disabled={pending||loading} onClick={refresh}>{t('childrenRefresh')}</Button>
    <p className="text-sm text-muted-foreground">{t('childrenNoGuardianship')}</p><p className="text-sm text-muted-foreground">{t('childrenNoBookings')}</p>
    {message&&<p role="status">{t(message)}</p>}{error&&<p role="alert" className="text-sm text-destructive">{t(error)}</p>}
  </div>;
}
