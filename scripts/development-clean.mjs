import pg from 'pg';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { developmentDatabaseUrl } from '../apps/api/dist/modules/identity/bootstrap.js';

export async function cleanDevelopmentDatabase(pool, environment=process.env) {
  const target=developmentDatabaseUrl(environment);
  // The reset intentionally excludes the existing conecta database and browser fixtures.
  if(target.pathname!=='/conecta_dev' && !/^\/test_[a-f0-9]{32}$/.test(target.pathname)) throw new Error('DEVELOPMENT_RESET_TARGET_REQUIRED');
  if(pool.options.connectionString!==environment.DATABASE_URL) throw new Error('DEVELOPMENT_DATABASE_MISMATCH');
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    if((await client.query('SELECT current_database() AS name')).rows[0].name!==target.pathname.slice(1)) throw new Error('DEVELOPMENT_DATABASE_MISMATCH');
    await client.query('DROP SCHEMA public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query('COMMIT');
  } catch(error) {await client.query('ROLLBACK');throw error;}
  finally {client.release();}
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  let pool;
  try {
    if(process.argv.slice(2).join(' ')!=='--development') throw new Error('DEVELOPMENT_FLAG_REQUIRED');
    developmentDatabaseUrl(process.env);
    pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:5000,statement_timeout:15000});
    await cleanDevelopmentDatabase(pool);
    console.log('Development public schema cleared, including accounts, bookings and audit history. Migrations follow in the npm command.');
  } catch(error) {
    const known=/^(DEVELOPMENT_FLAG_REQUIRED|DEVELOPMENT_FIXTURES_DISABLED|UNSAFE_DEVELOPMENT_DATABASE|DEVELOPMENT_RESET_TARGET_REQUIRED|DEVELOPMENT_DATABASE_MISMATCH)$/;
    console.error(known.test(error.message)?error.message:'DEVELOPMENT_RESET_FAILED');process.exitCode=1;
  } finally {if(pool) await pool.end();}
}
