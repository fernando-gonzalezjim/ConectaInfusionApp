import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { emitKeypressEvents } from 'node:readline';
import pg from 'pg';
import { createDevelopmentTestUser, developmentDatabaseUrl, generateFirstAdminSql } from '../apps/api/dist/modules/identity/bootstrap.js';

function parse(args) {
  const [command, ...flags] = args;
  if (!['admin-sql', 'testuser'].includes(command)) throw new Error('INVALID_BOOTSTRAP_COMMAND');
  const options = {};
  for (let index = 0; index < flags.length; index++) {
    const flag = flags[index];
    if (Object.hasOwn(options, flag)) throw new Error('INVALID_BOOTSTRAP_COMMAND');
    if (flag === '--development') options[flag] = true;
    else if (command === 'admin-sql' && ['--output', '--email', '--name', '--operator'].includes(flag)) {
      const value = flags[++index];
      if (!value || value.startsWith('--')) throw new Error('INVALID_BOOTSTRAP_COMMAND');
      options[flag] = value;
    } else throw new Error('INVALID_BOOTSTRAP_COMMAND');
  }
  if (command === 'testuser' && !options['--development']) throw new Error('INVALID_BOOTSTRAP_COMMAND');
  if (command === 'admin-sql' && (!options['--output'] || !options['--operator']
    || (options['--development'] ? options['--email'] || options['--name'] : !options['--email'] || !options['--name']))) {
    throw new Error('INVALID_BOOTSTRAP_COMMAND');
  }
  return { command, options };
}

// No password argument/env fallback: regular credentials never enter shell history or stdout.
async function hiddenPassword(label) {
  const input = process.stdin;
  if (!input.isTTY || !process.stdout.isTTY) throw new Error('INTERACTIVE_PASSWORD_REQUIRED');
  emitKeypressEvents(input);
  const previousRaw = input.isRaw;
  process.stdout.write(`${label}: `);
  input.setRawMode(true);
  input.resume();
  try {
    return await new Promise((accept, reject) => {
      let password = '';
      function keypress(character, key) {
        if (key?.ctrl && ['c', 'd'].includes(key.name)) finish(new Error('BOOTSTRAP_CANCELLED'));
        else if (['return', 'enter'].includes(key?.name)) finish(null);
        else if (key?.name === 'backspace') password = [...password].slice(0, -1).join('');
        else if (character && !key?.ctrl && !key?.meta && !character.includes('\u001b')) {
          password += character;
          if (password.length > 256) finish(new Error('INVALID_PASSWORD'));
        }
      }
      function finish(error) {
        input.removeListener('keypress', keypress);
        if (error) reject(error); else accept(password);
      }
      input.on('keypress', keypress);
    });
  } finally {
    input.setRawMode(previousRaw);
    input.pause();
    process.stdout.write('\n');
  }
}

export async function runBootstrapCommand(args, {
  environment = process.env, readPassword = hiddenPassword, log = console.log,
} = {}) {
  const { command, options } = parse(args);
  if (command === 'admin-sql') {
    if (options['--development']) developmentDatabaseUrl(environment);
    const password = options['--development'] ? undefined : await readPassword('First administrator password');
    if (!options['--development'] && password !== await readPassword('Confirm password')) throw new Error('PASSWORD_CONFIRMATION_MISMATCH');
    const sql = await generateFirstAdminSql({ development: Boolean(options['--development']),
      email: options['--email'], name: options['--name'], operator: options['--operator'], password, environment });
    const output = resolve(options['--output']);
    await mkdir(dirname(output), { recursive: true, mode: 0o700 });
    await writeFile(output, sql, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    log(`SQL file created at ${output}. Review and apply manually; no account was created.`);
  } else {
    developmentDatabaseUrl(environment); // Reject unsafe configuration before prompting/connecting.
    const password = await readPassword('Development admin password');
    const pool = new pg.Pool({ connectionString: environment.DATABASE_URL, max: 1,
      connectionTimeoutMillis: 5000, statement_timeout: 10000 });
    try {
      const result = await createDevelopmentTestUser(pool, password, environment);
      log(`Development testuser: ${result.status}. Existing accounts were not overwritten.`);
    } finally { await pool.end(); }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await runBootstrapCommand(process.argv.slice(2)); }
  catch (error) {
    const known = /^(INVALID_BOOTSTRAP_COMMAND|INVALID_BOOTSTRAP_INPUT|INVALID_PASSWORD|PASSWORD_WORK_BUSY|PASSWORD_CONFIRMATION_MISMATCH|INTERACTIVE_PASSWORD_REQUIRED|BOOTSTRAP_CANCELLED|INVALID_DEVELOPMENT_FIXTURE|DEVELOPMENT_FIXTURES_DISABLED|UNSAFE_DEVELOPMENT_DATABASE|DEVELOPMENT_DATABASE_MISMATCH|DEVELOPMENT_ADMIN_REQUIRED|DEVELOPMENT_FIXTURE_CONFLICT)$/;
    const code = known.test(error.message) ? error.message : error.code === 'EEXIST' ? 'OUTPUT_ALREADY_EXISTS' : 'BOOTSTRAP_FAILED';
    console.error(`${code}. See docs/idntityImplementation/identity-bootstrap.md. No credentials or database details are printed.`);
    process.exitCode = 1;
  }
}
