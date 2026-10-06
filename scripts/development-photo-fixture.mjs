import {mkdir,writeFile,lstat,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {developmentDatabaseUrl} from '../apps/api/dist/modules/identity/bootstrap.js';

// A synthetic color swatch for manual upload tests; never a real person's photo.
export async function createDemoPhotoFixture(environment=process.env){
  developmentDatabaseUrl(environment);
  const directory=fileURLToPath(new URL('../.local/',import.meta.url));
  await mkdir(directory,{recursive:true,mode:0o700});
  const stat=await lstat(directory),actual=await realpath(directory),expected=resolve(directory);
  const canonical=value=>process.platform==='win32'?value.toLowerCase():value;
  if(!stat.isDirectory()||stat.isSymbolicLink()||canonical(actual)!==canonical(expected))throw new Error('DEVELOPMENT_PHOTO_DIRECTORY_INVALID');
  const path=join(directory,'demo-profile.png');
  const image=await sharp({create:{width:800,height:600,channels:3,background:'#D7AED1'}}).png().toBuffer();
  try{await writeFile(path,image,{flag:'wx',mode:0o600});}
  catch(error){if(error.code!=='EEXIST')throw error;
    const existing=await lstat(path);if(!existing.isFile()||existing.isSymbolicLink())throw new Error('DEVELOPMENT_PHOTO_DIRECTORY_INVALID');
  } // Keep manually replaced fixtures unchanged.
  return path;
}
