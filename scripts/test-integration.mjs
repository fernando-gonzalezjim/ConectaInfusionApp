import { spawnSync } from 'node:child_process';
import { readdir,mkdtemp,rm } from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import pg from 'pg';
const compose=['compose','-f','compose.test.yaml','-p','conecta-foundation-tests'];
const isolatedEnvironment={...process.env,COMPOSE_FILE:'compose.test.yaml',COMPOSE_PROJECT_NAME:'conecta-foundation-tests'};
function run(command,args,env=process.env) {
  const result=spawnSync(command,args,{stdio:'inherit',env});
  if(result.error || result.status!==0) throw new Error(`${command} failed (${result.error?.code ?? result.status}). Docker must be installed and running; inspect the output above. Integration checks cannot be skipped.`);
}
let started=false;
const photoDirectory=await mkdtemp(join(tmpdir(),'conecta-browser-photos-'));
function npmScript(name) {
  if(!process.env.npm_execpath) throw new Error('Use npm run test:integration to run this suite.');
  run(process.execPath,[process.env.npm_execpath,'run',name],isolatedEnvironment);
}
try {
  run('docker',['version']);
  started=true; npmScript('db:up');
  const integrationFiles=(await readdir('apps/api/test/integration')).filter(name=>name.endsWith('.test.mjs')).sort();
  if(integrationFiles.length===0) throw new Error('No integration tests found.');
  run(process.execPath,['--test','--test-concurrency=1',...integrationFiles.map(name=>`apps/api/test/integration/${name}`)]);
  const admin=new pg.Pool({connectionString:'postgresql://foundation_test:foundation_test_only@127.0.0.1:55432/postgres'});
  try { await admin.query('CREATE DATABASE foundation_browser'); }
  finally { await admin.end(); }
  npmScript('db:migrate');
  npmScript('db:migrate');
  npmScript('db:validate');
  npmScript('db:info');
  run(process.execPath,['node_modules/@playwright/test/cli.js','test','--config=playwright.integration.config.ts'],{
    ...process.env, FOUNDATION_TEST_PHOTO_DIRECTORY:photoDirectory, FOUNDATION_TEST_DATABASE_URL:'postgresql://foundation_test:foundation_test_only@127.0.0.1:55432/foundation_browser'
  });
  for (const port of [3001,5173,5174]) {
    let stopped=false;
    for (let attempt=0;attempt<20;attempt++) {
      try { await fetch(`http://localhost:${port}/`,{signal:AbortSignal.timeout(500)}); }
      catch { stopped=true;break; }
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    if(!stopped) throw new Error(`Development server on port ${port} remained running after browser teardown.`);
  }
  console.log('Root dev lifecycle verified: API and both frontend ports closed after teardown.');
} catch(error) { console.error(error.message);process.exitCode=1; }
finally { if(started) { try {run('docker',[...compose,'down']);} catch {process.exitCode=1;} } await rm(photoDirectory,{recursive:true,force:true}); }
