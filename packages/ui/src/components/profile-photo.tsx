import {useEffect,useRef,useState} from 'react';
import type {AccountProfile,PhotoUploadInput} from '@conecta/contracts';
import {Button} from './button';
import {Input} from './input';
export type PhotoKey='profilePhoto'|'photoHint'|'uploadPhoto'|'photoSaved'|'photoInvalid'|'photoUnavailable'|'photoAlt';
export function ProfilePhoto({photoId,read,upload,t,disabled,onPending,onSaved,onAccessLost}:{
  photoId:string|null;read:(signal:AbortSignal)=>Promise<Blob>;upload:(input:PhotoUploadInput,signal:AbortSignal)=>Promise<AccountProfile>;
  t:(key:PhotoKey)=>string;disabled:boolean;onPending:(value:boolean)=>void;onSaved:(value:AccountProfile)=>void;onAccessLost:(error:unknown)=>void;
}){
  const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState<string|null>(null),[pending,setPending]=useState(false);
  const [error,setError]=useState<PhotoKey|null>(null),[saved,setSaved]=useState(false);
  const callbacks=useRef({read,upload,onPending,onSaved,onAccessLost});callbacks.current={read,upload,onPending,onSaved,onAccessLost};
  const request=useRef<AbortController|null>(null),input=useRef<HTMLInputElement|null>(null),busy=useRef(false);
  useEffect(()=>{
    setPreview(null);if(!photoId)return;
    const controller=new AbortController();let url:string|undefined;
    callbacks.current.read(controller.signal).then(blob=>{if(!controller.signal.aborted){url=URL.createObjectURL(blob);setPreview(url);}})
      .catch(value=>{if(!controller.signal.aborted){setError('photoUnavailable');callbacks.current.onAccessLost(value);}});
    return()=>{controller.abort();if(url)URL.revokeObjectURL(url);};
  },[photoId]);
  useEffect(()=>()=>{request.current?.abort();},[]);
  async function save(){
    if(disabled||busy.current||!file)return;
    if(!file.size||file.size>5*1024*1024){setError('photoInvalid');return;}
    busy.current=true;setPending(true);callbacks.current.onPending(true);setError(null);setSaved(false);
    const controller=new AbortController();request.current=controller;
    try{
      const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('PHOTO_READ_FAILED'));
        reader.onload=()=>resolve(String(reader.result).split(',')[1]??'');reader.readAsDataURL(file);});
      if(controller.signal.aborted)return;
      const result=await callbacks.current.upload({data},controller.signal);
      if(!controller.signal.aborted){callbacks.current.onSaved(result);setSaved(true);setFile(null);if(input.current)input.current.value='';}
    }catch(value){if(!controller.signal.aborted){setError(value instanceof Error&&'code' in value&&value.code==='INVALID_REQUEST'?'photoInvalid':'photoUnavailable');callbacks.current.onAccessLost(value);}}
    finally{busy.current=false;request.current=null;callbacks.current.onPending(false);if(!controller.signal.aborted)setPending(false);}
  }
  return <form className="space-y-3 border-t pt-4" aria-busy={pending} onSubmit={event=>{event.preventDefault();void save();}}>
    <fieldset disabled={disabled||pending} className="space-y-3"><legend className="mb-3 font-medium">{t('profilePhoto')}</legend>
      {preview&&<img src={preview} alt={t('photoAlt')} width={128} height={128} className="size-32 rounded-lg object-cover" />}
      <label className="block text-sm">{t('profilePhoto')}<Input ref={input} className="mt-1 h-auto min-h-11 py-2" type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{setFile(event.target.files?.[0]??null);setError(null);setSaved(false);}} /></label>
      <p className="text-sm text-muted-foreground">{t('photoHint')}</p><Button type="submit" disabled={!file} className="min-h-11">{t('uploadPhoto')}</Button>
    </fieldset>
    {error&&<p role="alert" className="text-sm text-destructive">{t(error)}</p>}{saved&&<p role="status" className="text-sm">{t('photoSaved')}</p>}
  </form>;
}
