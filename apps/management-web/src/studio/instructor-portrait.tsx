import {useEffect,useId,useRef,useState} from 'react';
import type {createApiClient} from '@conecta/api-client';
import type {StudioInstructor} from '@conecta/contracts';
import type {useLocale} from '@conecta/i18n';
import {Button} from '@conecta/ui/components/button';
import {Input} from '@conecta/ui/components/input';
export function InstructorPortrait({row,api,t,busy,onPending,onSaved,onError}:{row:StudioInstructor;api:ReturnType<typeof createApiClient>;t:ReturnType<typeof useLocale>['t'];busy:boolean;onPending:(pending:boolean)=>void;onSaved:(row:StudioInstructor)=>void;onError:(error:unknown)=>void}){
 const prefix=useId(),[file,setFile]=useState<File|null>(null),[altEs,setAltEs]=useState(row.photo?.altEs??''),[altEn,setAltEn]=useState(row.photo?.altEn??'');
 const lifetime=useRef<AbortController|null>(null);
 useEffect(()=>{const controller=new AbortController();lifetime.current=controller;return()=>controller.abort();},[]);
 async function save(remove:boolean){if(busy)return;if(!remove&&(!file||file.size>5*1024*1024||!altEs.trim())){onError({code:'INVALID_REQUEST'});return;}onPending(true);
  const signal=lifetime.current?.signal;if(!signal||signal.aborted)return;
  try{let saved:StudioInstructor;if(remove)saved=await api.removeStudioInstructorPhoto(row.instructorId,{expectedVersion:row.version},signal);else{
   const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();const abort=()=>{reader.abort();reject(new Error('IMAGE_READ_ABORTED'));};signal.addEventListener('abort',abort,{once:true});const finish=()=>signal.removeEventListener('abort',abort);reader.onload=()=>{finish();typeof reader.result==='string'?resolve(reader.result.slice(reader.result.indexOf(',')+1)):reject(new Error('INVALID_IMAGE'));};reader.onerror=()=>{finish();reject(new Error('IMAGE_READ_FAILED'));};reader.readAsDataURL(file!);});
   if(signal.aborted)return;
   saved=await api.uploadStudioInstructorPhoto(row.instructorId,{data,altEs,altEn:altEn.trim()||null,expectedVersion:row.version},signal);
  }if(!signal.aborted){onSaved(saved);setFile(null);}}catch(e){if(!signal.aborted)onError(e);}finally{if(!signal.aborted)onPending(false);}
 }
 return <fieldset disabled={busy} className="grid gap-3 rounded-lg border p-4"><legend className="px-2">{t('catalogPortrait')}</legend><p className="text-sm text-muted-foreground">{t('catalogPortraitHint')}</p>{row.photo&&<p>{t('catalogPortraitApproved')}: {row.photo.altEs}</p>}
 <div className="grid gap-2"><label htmlFor={prefix+'file'}>{t('catalogPortraitFile')}</label><Input key={row.version} id={prefix+'file'} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]??null)}/></div>
 <div className="grid gap-2"><label htmlFor={prefix+'es'}>{t('catalogAltEs')}</label><Input id={prefix+'es'} maxLength={300} value={altEs} onChange={e=>setAltEs(e.target.value)}/></div>
 <div className="grid gap-2"><label htmlFor={prefix+'en'}>{t('catalogAltEn')}</label><Input id={prefix+'en'} maxLength={300} value={altEn} onChange={e=>setAltEn(e.target.value)}/></div>
 <div className="flex flex-wrap gap-3"><Button type="button" disabled={busy||!file||!altEs.trim()} onClick={()=>save(false)}>{t('catalogApprovePortrait')}</Button>{row.photo&&<Button type="button" variant="outline" disabled={busy} onClick={()=>save(true)}>{t('catalogRemovePortrait')}</Button>}</div></fieldset>;
}
