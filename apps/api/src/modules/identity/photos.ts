import sharp from 'sharp';
import {randomUUID} from 'node:crypto';
import {constants} from 'node:fs';
import {mkdir,lstat,realpath,open,unlink,opendir} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {isAbsolute,resolve,join,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {Pool} from 'pg';
import type {createAccountService} from './accounts.js';
import type {SessionService} from './sessions.js';
import {AuthError} from './sessions.js';
const maxBytes=5*1024*1024;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
let decoding=0;

// Official Sharp docs: api-constructor (failOn/pixels/pages), api-output (metadata stripped by default).
export async function encodeProfilePhoto(input:Buffer):Promise<Buffer>{
  if(!Buffer.isBuffer(input)||!input.length||input.length>maxBytes)throw new AuthError('INVALID_REQUEST');
  const png=input.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg=input[0]===255&&input[1]===216&&input[2]===255;
  const webp=input.subarray(0,4).toString()==='RIFF'&&input.subarray(8,12).toString()==='WEBP';
  if(!png&&!jpeg&&!webp)throw new AuthError('INVALID_REQUEST');
  if(png)for(let offset=8;offset+12<=input.length;){
    const length=input.readUInt32BE(offset),kind=input.subarray(offset+4,offset+8).toString();
    if(kind==='acTL'||length>input.length-offset-12)throw new AuthError('INVALID_REQUEST');offset+=12+length;
  }
  if(decoding>=2)throw new Error('PHOTO_BUSY');decoding++;
  try{
    const image=sharp(input,{limitInputPixels:16000000,failOn:'warning'});
    const metadata=await image.metadata();
    if(!['jpeg','png','webp'].includes(metadata.format??'')||(metadata.pages??1)!==1||!metadata.width||!metadata.height
      ||metadata.width*metadata.height>16000000)throw new Error('INVALID_PHOTO');
    return await image.rotate().resize({width:512,height:512,fit:'inside',withoutEnlargement:true}).webp({quality:80}).toBuffer();
  }catch{throw new AuthError('INVALID_REQUEST');}finally{decoding--;}
}
function bytes(value:unknown):Buffer{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).join(',')!=='data')throw new AuthError('INVALID_REQUEST');
  const data=(value as {data:unknown}).data;
  if(typeof data!=='string'||!data.length||data.length%4!==0||data.length>Math.ceil(maxBytes/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(data))throw new AuthError('INVALID_REQUEST');
  const buffer=Buffer.from(data,'base64');if(buffer.length>maxBytes||buffer.toString('base64')!==data)throw new AuthError('INVALID_REQUEST');return buffer;
}

export function createPhotoService(pool:Pool,sessions:SessionService,accounts:ReturnType<typeof createAccountService>,directory?:string,
  options:{unlink?:typeof unlink;now?:()=>number}={}){
  const deleteFile=options.unlink??unlink,clock=options.now??Date.now;
  const root=directory&&isAbsolute(directory)?resolve(directory):null;
  const workspace=fileURLToPath(new URL('../../../../../',import.meta.url));
  const inside=root?relative(workspace,root):null;
  if(directory&&(!root||root===resolve(root, '..')||/[\\/](public|dist|node_modules|\.git|\.agents|\.codex)([\\/]|$)/i.test(root)))throw new Error('PHOTO_DIRECTORY_INVALID');
  if(root&&inside!==null&&!inside.startsWith('..'+sep)&&!isAbsolute(inside)&&inside.split(sep)[0]!=='.local')throw new Error('PHOTO_DIRECTORY_INVALID');
  async function storage():Promise<string>{
    if(!root)throw new Error('PHOTO_STORAGE_UNAVAILABLE');
    await mkdir(root,{recursive:true,mode:0o700});const stat=await lstat(root);
    const actual=await realpath(root),canonical=(value:string)=>process.platform==='win32'?value.toLowerCase():value;
    if(!stat.isDirectory()||stat.isSymbolicLink()||canonical(actual)!==canonical(root))throw new Error('PHOTO_DIRECTORY_INVALID');
    return root;
  }
  async function file(id:string){
    if(!uuid.test(id))throw new Error('PHOTO_ID_INVALID');const directory=await storage(),path=join(directory,id+'.webp');
    if(relative(directory,path).split(sep).length!==1)throw new Error('PHOTO_PATH_INVALID');return path;
  }
  async function removeUnreferenced(id:string){
    // Database ownership is checked before deletion, including an uncertain COMMIT response.
    if((await pool.query('SELECT 1 FROM people WHERE photo_id=$1 LIMIT 1',[id])).rowCount)return;
    const path=await file(id);
    try{const stat=await lstat(path);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('PHOTO_PATH_INVALID');
      for(let attempt=0;;attempt++)try{await deleteFile(path);break;}catch(error){
        const code=error&&typeof error==='object'&&'code' in error?error.code:null;
        if(attempt===4||!['EPERM','EBUSY'].includes(String(code)))throw error;await delay(25*2**attempt);
      }}
    catch(error){if(!(error&&typeof error==='object'&&'code' in error&&error.code==='ENOENT'))throw error;}
  }
  let sweeping=false;
  async function reconcile(){
    if(!root||sweeping)return;sweeping=true;
    try{
      const directory=await storage();let batch:string[]=[];
      async function clean(){
        const referenced=new Set((await pool.query<{photo_id:string}>('SELECT photo_id FROM people WHERE photo_id=ANY($1::uuid[])',[batch])).rows.map(row=>row.photo_id));
        for(const id of batch)if(!referenced.has(id)){
          const stat=await lstat(await file(id)).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
          // Staged uploads are protected; request/DB work is bounded well below this 24-hour grace.
          if(stat?.isFile()&&!stat.isSymbolicLink()&&stat.mtimeMs<clock()-24*60*60*1000)await removeUnreferenced(id);
        }
        batch=[];
      }
      for await(const entry of await opendir(directory))if(entry.isFile()&&entry.name.endsWith('.webp')&&uuid.test(entry.name.slice(0,-5))){
        batch.push(entry.name.slice(0,-5));if(batch.length===100)await clean();
      }
      if(batch.length)await clean();
    }finally{sweeping=false;}
  }
  async function target(id:unknown,token:unknown){return id??(await sessions.resolve(token)).account.id;}
  return {
    reconcile,
    startCleanup(){
      if(!root)return ()=>{};
      const sweep=()=>{void reconcile().catch(()=>console.warn('PHOTO_CLEANUP_REQUIRED'));};
      sweep();const timer=setInterval(sweep,10*60*1000);timer.unref();return ()=>clearInterval(timer);
    },
    async upload(id:unknown,value:unknown,token:unknown){
      const accountId=await target(id,token);await accounts.readAuthorized(accountId,token); // Deny before decode/filesystem work.
      const output=await encodeProfilePhoto(bytes(value));const photoId=randomUUID(),path=await file(photoId);
      const handle=await open(path,'wx',0o600);
      try{try{await handle.writeFile(output);}finally{await handle.close();}}
      catch(error){await removeUnreferenced(photoId);throw error;}
      let result;
      try{result=await accounts.replacePhoto(accountId,photoId,token);}
      catch(error){try{await removeUnreferenced(photoId);}catch{console.warn('PHOTO_CLEANUP_REQUIRED');}throw error;}
      if(result.previousPhotoId)try{await removeUnreferenced(result.previousPhotoId);}catch{console.warn('PHOTO_CLEANUP_REQUIRED');}
      return result.profile;
    },
    async read(id:unknown,token:unknown){
      for(let attempt=0;attempt<2;attempt++){
        const profile=await accounts.readAuthorized(await target(id,token),token);if(!profile.photoId)throw new AuthError('NOT_FOUND');
        let handle;
        try{const path=await file(profile.photoId),entry=await lstat(path);
          if(!entry.isFile()||entry.isSymbolicLink())throw new Error('PHOTO_FILE_INVALID');
          handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);const stat=await handle.stat();
          if(!stat.isFile()||stat.size>1024*1024)throw new Error('PHOTO_FILE_INVALID');return await handle.readFile();}
        catch(error){if(!(error&&typeof error==='object'&&'code' in error&&error.code==='ENOENT'))throw error;}
        finally{await handle?.close();}
      }
      throw new AuthError('NOT_FOUND');
    }
  };
}
