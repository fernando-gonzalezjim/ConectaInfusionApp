import {useEffect,useId,useRef,useState,type FormEvent} from 'react';
import type {StudioDiscipline,StudioDisciplineInput,StudioDisciplineUpdate} from '@conecta/contracts';
import type {useLocale} from '@conecta/i18n';
import {Button} from '@conecta/ui/components/button';
import {Input} from '@conecta/ui/components/input';

interface Api {
  listStudioDisciplines(query?:{cursor?:string},signal?:AbortSignal):Promise<{items:StudioDiscipline[];nextCursor:string|null}>;
  createStudioDiscipline(input:StudioDisciplineInput):Promise<StudioDiscipline>;
  updateStudioDiscipline(id:string,input:StudioDisciplineUpdate):Promise<StudioDiscipline>;
}
type Text=ReturnType<typeof useLocale>['t'];
const empty={nameEs:'',nameEn:'',descriptionEs:'',descriptionEn:'',status:'draft' as StudioDiscipline['status']};
export function StudioDisciplines({api,t,locale,onAccessLost}:{api:Api;t:Text;locale:string;onAccessLost:(code:'FORBIDDEN'|'UNAUTHENTICATED')=>void}){
  const prefix=useId(),nameRef=useRef<HTMLInputElement>(null),returnFocus=useRef<HTMLButtonElement|null>(null);
  const [items,setItems]=useState<StudioDiscipline[]>([]),[cursor,setCursor]=useState<string|null>(null);
  const [attempt,setAttempt]=useState(0),[loading,setLoading]=useState(true),[loadFailed,setLoadFailed]=useState(false);
  const [editing,setEditing]=useState<StudioDiscipline|null|undefined>(undefined),[form,setForm]=useState(empty);
  const [busy,setBusy]=useState(false),[error,setError]=useState<'studioConflict'|'studioInvalid'|'studioUnavailable'|null>(null);
  const [saved,setSaved]=useState(false);
  const generation=useRef(0);
  const focusAfterClose=useRef(false);
  useEffect(()=>{if(editing===undefined&&!busy&&!loading&&focusAfterClose.current){focusAfterClose.current=false;returnFocus.current?.focus();}},[editing,busy,loading]);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setLoadFailed(false);generation.current++;
    api.listStudioDisciplines({},controller.signal).then(page=>{if(!controller.signal.aborted){setItems(page.items);setCursor(page.nextCursor);}})
      .catch(e=>{if(!controller.signal.aborted){if(e.code==='FORBIDDEN'||e.code==='UNAUTHENTICATED')onAccessLost(e.code);else setLoadFailed(true);}})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>{controller.abort();generation.current++;};
  },[api,attempt,onAccessLost]);
  useEffect(()=>{if(editing!==undefined)nameRef.current?.focus();},[editing]);
  function open(row:StudioDiscipline|null,trigger:HTMLButtonElement){returnFocus.current=trigger;setEditing(row);setForm(row?{nameEs:row.nameEs,nameEn:row.nameEn??'',descriptionEs:row.descriptionEs,descriptionEn:row.descriptionEn??'',status:row.status}:empty);setError(null);setSaved(false);}
  function failed(e:unknown){const code=e&&typeof e==='object'&&'code'in e?e.code:null;if(code==='FORBIDDEN'||code==='UNAUTHENTICATED')onAccessLost(code);else setError(code==='CONFLICT'?'studioConflict':code==='INVALID_REQUEST'?'studioInvalid':'studioUnavailable');}
  async function save(event:FormEvent){
    event.preventDefault();if(busy||loading||editing===undefined)return;setBusy(true);setError(null);setSaved(false);
    const epoch=generation.current;
    const data={...form,nameEn:form.nameEn.trim()||null,descriptionEn:form.descriptionEn.trim()||null};
    try{
      const row=editing?await api.updateStudioDiscipline(editing.id,{...data,expectedVersion:editing.version})
        :await api.createStudioDiscipline({...data,status:data.status==='published'?'published':'draft'});
      if(epoch!==generation.current)return;
      setItems(previous=>[row,...previous.filter(item=>item.id!==row.id)]);focusAfterClose.current=true;setEditing(undefined);setSaved(true);
    }catch(e){if(epoch===generation.current)failed(e);}finally{if(epoch===generation.current)setBusy(false);}
  }
  async function more(){
    if(!cursor||loading)return;setLoading(true);const epoch=generation.current;
    try{const page=await api.listStudioDisciplines({cursor});if(epoch!==generation.current)return;
      setItems(previous=>[...previous,...page.items.filter(row=>!previous.some(item=>item.id===row.id))]);setCursor(page.nextCursor);
    }catch(e){if(epoch===generation.current){setLoadFailed(true);failed(e);}}finally{if(epoch===generation.current)setLoading(false);}
  }
  return <section aria-labelledby={prefix+'title'} className="my-8 rounded-2xl border bg-white p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id={prefix+'title'} className="text-xl font-semibold">{t('studioDisciplines')}</h2><div className="flex flex-wrap gap-3"><Button variant="outline" disabled={busy||loading} onClick={()=>setAttempt(n=>n+1)}>{t('studioRefresh')}</Button><Button disabled={busy||loading} onClick={e=>open(null,e.currentTarget)}>{t('studioNewDiscipline')}</Button></div></div>
    <p className="my-3 text-sm text-muted-foreground">{t('studioDisciplineIntro')}</p>
    {saved&&<p role="status">{t('studioSaved')}</p>}
    {loading&&<p role="status">{t('loading')}</p>}
    {loadFailed&&<div role="alert">{t('studioUnavailable')} <Button variant="outline" disabled={busy} onClick={()=>setAttempt(n=>n+1)}>{t('retry')}</Button></div>}
    {editing!==undefined&&<form aria-label={t('studioDisciplineForm')} onSubmit={save} className="my-6 grid gap-4">
      {(['nameEs','nameEn','descriptionEs','descriptionEn'] as const).map(field=><label key={field} htmlFor={prefix+field} className="grid gap-2 text-sm font-medium">{t(field==='nameEs'?'studioNameEs':field==='nameEn'?'studioNameEn':field==='descriptionEs'?'studioDescriptionEs':'studioDescriptionEn')}
        {field.startsWith('name')?<Input id={prefix+field} ref={field==='nameEs'?nameRef:undefined} required={field==='nameEs'} maxLength={120} disabled={busy} value={form[field]} onChange={e=>setForm({...form,[field]:e.target.value})}/>
          :<textarea id={prefix+field} className="min-h-24 w-full rounded-md border border-input p-3" required={field==='descriptionEs'&&form.status==='published'} maxLength={4000} disabled={busy} value={form[field]} onChange={e=>setForm({...form,[field]:e.target.value})}/>}
      </label>)}
      <div className="grid gap-2 text-sm font-medium"><label htmlFor={prefix+'status'}>{t('studioStatus')}</label><select id={prefix+'status'} disabled={busy} className="rounded-md border border-input p-3" value={form.status} onChange={e=>setForm({...form,status:e.target.value as StudioDiscipline['status']})}>
        <option value="draft">{t('studioDraft')}</option><option value="published">{t('studioPublished')}</option>{editing&&<option value="archived">{t('studioArchived')}</option>}
      </select></div>
      {error&&<p role="alert">{t(error)}</p>}
      <div className="flex flex-wrap gap-3"><Button disabled={busy||loading} type="submit">{t('studioSaveDiscipline')}</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>{focusAfterClose.current=true;setEditing(undefined);}}>{t('studioCancel')}</Button></div>
    </form>}
    {!loading&&!loadFailed&&items.length===0&&<p>{t('studioEmpty')}</p>}
    <ul className="mt-4 grid gap-3">{items.map(row=><li key={row.id}><article className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"><div className="min-w-0"><h3 className="break-words font-medium">{locale==='en'?(row.nameEn||row.nameEs):row.nameEs}</h3><p className="text-sm text-muted-foreground">{t(row.status==='draft'?'studioDraft':row.status==='published'?'studioPublished':'studioArchived')}</p></div><Button variant="outline" disabled={busy||loading} onClick={e=>open(row,e.currentTarget)}>{t('studioEditDiscipline')}</Button></article></li>)}</ul>
    {cursor&&<Button variant="outline" disabled={loading||busy} onClick={more}>{t('studioMore')}</Button>}
  </section>;
}
