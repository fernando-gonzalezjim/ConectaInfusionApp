import { spawnSync } from 'node:child_process';
import pg from 'pg';
const compose=['compose','-f','compose.test.yaml','-p','conecta-foundation-tests'];
function run(command,args,env=process.env) {
  const result=spawnSync(command,args,{stdio:'inherit',env});
  if(result.error || result.status!==0) throw new Error(`${command} failed (${result.error?.code ?? result.status}). Docker must be installed and running; inspect the output above. Integration checks cannot be skipped.`);
}
let started=false;
try {
  run('docker',['version']);
  started=true; run('docker',[...compose,'up','-d','--wait','db']);
  run(process.execPath,['--test','--test-concurrency=1','apps/api/test/integration/foundation.test.mjs']);
  const admin=new pg.Pool({connectionString:'postgresql://foundation_test:foundation_test_only@127.0.0.1:55432/postgres'});
  try { await admin.query('CREATE DATABASE foundation_browser'); }
  finally { await admin.end(); }
  run('docker',[...compose,'run','--rm','--no-deps','-e','FLYWAY_URL=jdbc:postgresql://db:5432/foundation_browser','flyway','migrate']);
  run(process.execPath,['node_modules/@playwright/test/cli.js','test','--config=playwright.integration.config.ts'],{
    ...process.env, FOUNDATION_TEST_DATABASE_URL:'postgresql://foundation_test:foundation_test_only@127.0.0.1:55432/foundation_browser'
  });
} catch(error) { console.error(error.message);process.exitCode=1; }
finally { if(started) { try {run('docker',[...compose,'down']);} catch {process.exitCode=1;} } }
