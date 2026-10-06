import {useEffect,useRef,useState} from 'react';
import type {GuardianInviteTarget,GuardianRemovalTarget,GuardianRemovedResponse,IdentityPage} from '@conecta/contracts';
import {Button} from './button';
import {Dialog,DialogTrigger,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './dialog';
export interface GuardianRemovalApi {
  listGuardians(id:string,query?:{limit?:number;cursor?:string},signal?:AbortSignal):Promise<IdentityPage<GuardianRemovalTarget>>;
  removeGuardian(id:string,relationshipId:string,signal?:AbortSignal):Promise<GuardianRemovedResponse>;
}
export type GuardianRemovalKey='guardianManage'|'guardianRemovalIntro'|'guardianEnd'|'guardianConfirmRemoval'|'guardianRemoving'|'guardianRemoved'|'guardianRemovalConflict'|'guardianRemovalUncertain'|'guardianRemovalUnavailable'|'guardianRefresh'|'guardianPreserved'|'childrenLoading'|'childrenPrevious'|'childrenNext'|'childrenCancel'|'authExpired'|'authForbidden'|'close';
type Props={api:GuardianRemovalApi;t:(key:GuardianRemovalKey)=>string;dependent:GuardianInviteTarget;onAccessLost:(code:'UNAUTHENTICATED'|'FORBIDDEN')=>void;onRemoved:()=>void};
export function GuardianRemoval(props:Props){
  const {t,dependent}=props,[open,setOpen]=useState(false),[pending,setPending]=useState(false);
  return <Dialog open={open} onOpenChange={value=>{if(!pending)setOpen(value);}}>
    <DialogTrigger asChild><Button variant="outline" className="min-h-11 whitespace-normal" aria-label={`${t('guardianManage')}: ${dependent.fullName}`}>{t('guardianManage')}</Button></DialogTrigger>
    <DialogContent closeLabel={t('close')} closeDisabled={pending} onEscapeKeyDown={e=>{if(pending)e.preventDefault();}} onInteractOutside={e=>{if(pending)e.preventDefault();}} className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
      <DialogHeader><DialogTitle>{t('guardianManage')}</DialogTitle><DialogDescription>{t('guardianRemovalIntro')}</DialogDescription></DialogHeader>
      <RemovalPanel {...props} onPending={setPending} done={()=>{setOpen(false);props.onRemoved();}}/>
    </DialogContent>
  </Dialog>;
}
function RemovalPanel({api,t,dependent,onAccessLost,onPending,done}:Props&{onPending:(value:boolean)=>void;done:()=>void}){
  const [page,setPage]=useState<IdentityPage<GuardianRemovalTarget>|null>(null),[cursors,setCursors]=useState<(string|undefined)[]>([undefined]),[attempt,setAttempt]=useState(0);
  const [selected,setSelected]=useState<GuardianRemovalTarget|null>(null),[loading,setLoading]=useState(true),[pending,setPending]=useState(false),[blocked,setBlocked]=useState(false),[error,setError]=useState<GuardianRemovalKey|null>(null);
  const request=useRef<AbortController|null>(null),cursor=cursors.at(-1);
  function lost(code:unknown){if(code==='UNAUTHENTICATED'||code==='FORBIDDEN'){setPage(null);setSelected(null);onAccessLost(code);return true;}return false;}
  useEffect(()=>{const c=new AbortController();setLoading(true);setPage(null);setSelected(null);setError(null);
    api.listGuardians(dependent.id,{limit:10,cursor},c.signal).then(value=>{if(!c.signal.aborted){setPage(value);setBlocked(false);}}).catch(reason=>{if(!c.signal.aborted){const code=reason instanceof Error&&'code' in reason?reason.code:null;lost(code);setError(code==='UNAUTHENTICATED'?'authExpired':code==='FORBIDDEN'?'authForbidden':'guardianRemovalUnavailable');}}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();
  },[api,dependent.id,cursor,attempt,onAccessLost]);
  useEffect(()=>()=>request.current?.abort(),[]);
  async function remove(){if(!selected||blocked||loading||request.current)return;const c=new AbortController();request.current=c;setPending(true);onPending(true);setError(null);
    try{await api.removeGuardian(dependent.id,selected.id,c.signal);if(!c.signal.aborted)done();}
    catch(reason){if(!c.signal.aborted){const code=reason instanceof Error&&'code' in reason?reason.code:null;lost(code);setBlocked(true);if(code==='NOT_FOUND')setPage(null);setError(code==='UNAUTHENTICATED'?'authExpired':code==='FORBIDDEN'?'authForbidden':code==='CONFLICT'?'guardianRemovalConflict':'guardianRemovalUncertain');}}
    finally{if(request.current===c){request.current=null;setPending(false);onPending(false);}}
  }
  return <div className="space-y-4" aria-busy={loading||pending}>
    <h3 className="break-words font-semibold">{dependent.fullName}</h3>
    {loading?<p role="status">{t('childrenLoading')}</p>:page&&<ul className="space-y-3">{page.items.map(g=><li key={g.id} className="flex flex-wrap items-center gap-2"><span className="break-words">{g.fullName}</span>{g.canRemove&&<Button variant="outline" className="min-h-11 whitespace-normal" disabled={pending||blocked} aria-label={`${t('guardianEnd')}: ${g.fullName}`} onClick={()=>setSelected(g)}>{t('guardianEnd')}</Button>}</li>)}</ul>}
    {selected&&<div className="space-y-3 rounded-md border p-3"><p className="break-words font-semibold">{selected.fullName}</p><p>{t('guardianPreserved')}</p><Button className="min-h-11 whitespace-normal" disabled={pending||blocked||loading} onClick={()=>void remove()}>{t(pending?'guardianRemoving':'guardianConfirmRemoval')}</Button><Button variant="outline" className="min-h-11" disabled={pending} onClick={()=>setSelected(null)}>{t('childrenCancel')}</Button></div>}
    <nav className="flex flex-wrap gap-2"><Button variant="outline" className="min-h-11" disabled={pending||loading||blocked||cursors.length===1} onClick={()=>setCursors(v=>v.slice(0,-1))}>{t('childrenPrevious')}</Button><Button variant="outline" className="min-h-11" disabled={pending||loading||blocked||!page?.nextCursor} onClick={()=>setCursors(v=>[...v,page!.nextCursor!])}>{t('childrenNext')}</Button></nav>
    <Button variant="outline" className="min-h-11" disabled={pending||loading} onClick={()=>setAttempt(v=>v+1)}>{t('guardianRefresh')}</Button>
    {error&&<p role="alert" className="text-sm text-destructive">{t(error)}</p>}
  </div>;
}
