import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {hashPassword} from '../../apps/api/src/modules/identity/passwords.js';

for(const locale of ['es-MX','en'] as const)test(`real ${locale} child details convert and guardian edits preserve attendee history`,async({page})=>{
  const connectionString=process.env.FOUNDATION_TEST_DATABASE_URL;
  if(connectionString!=='postgresql://foundation_test:foundation_test_only@127.0.0.1:55432/foundation_browser')throw new Error('Disposable database required');
  const pool=new pg.Pool({connectionString}),en=locale==='en',errors:string[]=[],password='Real guardian browser password';page.on('pageerror',error=>errors.push(error.message));
  try{
    const email=`guardian-${randomUUID()}@example.test`,childName=`Fictional child ${randomUUID()}`;
    const person=(await pool.query('INSERT INTO people(full_name,preferred_locale) VALUES ($1,$2) RETURNING id',['Fictional guardian',locale])).rows[0];
    const account=(await pool.query("INSERT INTO accounts(person_id,email,password_hash,status,confirmation_status,email_verified_at) VALUES ($1,$2,$3,'active','verified',now()) RETURNING id",[person.id,email,await hashPassword(password)])).rows[0];
    await pool.query("INSERT INTO account_roles(account_id,role) VALUES ($1,'customer')",[account.id]);
    await page.goto('http://localhost:5173');await page.getByLabel('Idioma',{exact:true}).selectOption(locale);
    await page.getByRole('button',{name:en?'Sign in':'Iniciar sesión',exact:true}).click();await page.getByLabel(en?'Email':'Correo electrónico',{exact:true}).fill(email);await page.getByLabel(en?'Password':'Contraseña',{exact:true}).fill(password);await page.getByRole('dialog').getByRole('button',{name:en?'Sign in':'Iniciar sesión',exact:true}).click();
    await page.getByRole('button',{name:en?'Children and dependents':'Menores y dependientes',exact:true}).click();const dialog=page.getByRole('dialog');
    await dialog.getByRole('button',{name:en?'Save child details':'Guardar datos de un menor',exact:true}).click();await dialog.getByLabel(en?"Child's name":'Nombre del menor',{exact:true}).fill(childName);await dialog.getByLabel(en?'Age (text)':'Edad (texto)',{exact:true}).fill('8');await dialog.getByRole('button',{name:en?'Save details':'Guardar datos',exact:true}).click();await expect(dialog.getByRole('heading',{name:childName,exact:true})).toBeVisible();
    const saved=(await pool.query('SELECT * FROM saved_child_details WHERE owner_account_id=$1',[account.id])).rows[0];expect(saved.dependent_person_id).toBeNull();
    // Controlled historical booking fixture; this does not expose a child-booking UI.
    const member=(await pool.query('INSERT INTO members(full_name,email,person_id) VALUES ($1,$2,$3) RETURNING id',['Fictional guardian',email,person.id])).rows[0];
    const instructor=(await pool.query("INSERT INTO instructors(full_name) VALUES ('Fictional child instructor') RETURNING id")).rows[0];
    const session=(await pool.query("INSERT INTO class_sessions(title,instructor_id,starts_at,duration_minutes,capacity) VALUES ('Yoga Kids',$1,now(),60,16) RETURNING id",[instructor.id])).rows[0];
    const booking=(await pool.query('INSERT INTO bookings(member_id,class_session_id,acting_account_id,saved_child_details_id,child_name_snapshot,child_age_snapshot) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',[member.id,session.id,account.id,saved.id,childName,'8'])).rows[0];
    await dialog.getByRole('button',{name:en?/^Convert to profile:/ :/^Convertir a perfil:/}).click();expect((await pool.query('SELECT dependent_person_id FROM saved_child_details WHERE id=$1',[saved.id])).rows[0].dependent_person_id).toBeNull();
    await dialog.getByRole('button',{name:en?'Create profile and become guardian':'Crear perfil y ser tutor',exact:true}).click();await expect(dialog.getByRole('status').filter({hasText:en?'Profile created':'Perfil creado'})).toBeVisible();
    const linked=(await pool.query('SELECT dependent_person_id FROM saved_child_details WHERE id=$1',[saved.id])).rows[0].dependent_person_id;expect(linked).toBeTruthy();expect(linked).not.toBe(person.id);
    await dialog.getByRole('button',{name:en?'Dependent profiles':'Perfiles de dependientes',exact:true}).click();await expect(dialog.getByText('Fictional guardian',{exact:true})).toBeVisible();
    await dialog.getByRole('button',{name:en?/^Edit profile:/ :/^Editar perfil:/}).click();await dialog.getByLabel(en?"Child's name":'Nombre del menor',{exact:true}).fill('Edited fictional child');await dialog.getByLabel(en?'Age (text)':'Edad (texto)',{exact:true}).fill('9');await dialog.getByRole('button',{name:en?'Save profile':'Guardar perfil',exact:true}).click();await expect(dialog.getByRole('heading',{name:'Edited fictional child',exact:true})).toBeVisible();
    expect((await pool.query('SELECT count(*)::int n FROM accounts WHERE person_id=$1',[linked])).rows[0].n).toBe(0);
    expect((await pool.query('SELECT * FROM bookings WHERE id=$1',[booking.id])).rows[0]).toEqual(booking);
    const audit=(await pool.query("SELECT actor_id,changes FROM audit_events WHERE target_id=$1 AND action='dependent.profile_updated'",[linked])).rows[0];expect(audit.actor_id).toBe(account.id);expect(JSON.stringify(audit.changes)).not.toContain('Edited fictional child');expect(errors).toEqual([]);
  }finally{await pool.end();}
});
