import {useEffect,useRef,useState} from 'react';
export function useCatalogList<T extends {id:string}|{instructorId:string}>(read:(q:{cursor?:string},signal?:AbortSignal)=>Promise<{items:T[];nextCursor:string|null}>,onAccessLost:(code:'UNAUTHENTICATED'|'FORBIDDEN')=>void){
 const [items,setItems]=useState<T[]>([]),[cursor,setCursor]=useState<string|null>(null),[loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
 const generation=useRef(0),controller=useRef<AbortController|null>(null);
 function handle(error:unknown){const code=error&&typeof error==='object'&&'code'in error?error.code:null;if(code==='UNAUTHENTICATED'||code==='FORBIDDEN')onAccessLost(code);else setFailed(true);}
 useEffect(()=>{const abort=new AbortController();controller.current=abort;const epoch=++generation.current;setLoading(true);setFailed(false);
  read({},abort.signal).then(p=>{if(epoch===generation.current&&!abort.signal.aborted){setItems(p.items);setCursor(p.nextCursor);}}).catch(e=>{if(!abort.signal.aborted&&epoch===generation.current)handle(e);}).finally(()=>{if(!abort.signal.aborted&&epoch===generation.current)setLoading(false);});
  return ()=>{abort.abort();generation.current++;};
 },[read,attempt,onAccessLost]);
 async function more(){if(!cursor||loading)return;const epoch=generation.current;setLoading(true);setFailed(false);try{const p=await read({cursor},controller.current?.signal);if(epoch===generation.current){setItems(v=>{const key=(item:T)=>'id'in item?item.id:item.instructorId;const known=new Set(v.map(key));return [...v,...p.items.filter(item=>!known.has(key(item)))];});setCursor(p.nextCursor);}}catch(e){if(epoch===generation.current&&!controller.current?.signal.aborted)handle(e);}finally{if(epoch===generation.current)setLoading(false);}}
 return {items,setItems,cursor,loading,failed,more,refresh:()=>setAttempt(n=>n+1),generation,signal:()=>controller.current?.signal};
}
