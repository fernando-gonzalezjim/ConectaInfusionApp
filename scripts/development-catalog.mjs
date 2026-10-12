import {randomBytes,randomUUID} from 'node:crypto';
import sharp from 'sharp';

// Only called by the guarded demo entrypoint, on its existing transaction.
export async function seedDevelopmentCatalog(client,id) {
  let created=0;
  for(const [key,name,status] of [['yoga','Demo Yoga','draft'],['ballet','Demo Ballet','draft'],['wellness','Demo Wellness','published']]) {
    const result=await client.query(`INSERT INTO studio_disciplines(id,name_es,description_es,status)
      VALUES ($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING`,[id(`catalog-discipline:${key}`),name,status==='published'?'Disciplina ficticia para explorar el catálogo.':'',status]);
    created+=result.rowCount;
  }
  for(const [key,discipline,name,audience,level,min,max,color,status] of [
    ['adult-yoga','yoga','Demo Adult Yoga','adults','all',null,null,'#336699','draft'],
    ['children-ballet','ballet',"Demo Children's Ballet",'children','beginner',6,12,'#8855AA','draft'],
    ['children-yoga','yoga',"Demo Children's Yoga",'children','intermediate',null,null,null,'draft'],
    ['advanced-ballet','ballet','Demo Advanced Ballet','adults','advanced',null,null,'#f5dfbf','draft'],
    ['published-yoga','wellness','Demo Published Yoga','adults','all',null,null,'#346855','published'],
    ['archived-yoga','wellness','Demo Archived Yoga','adults','beginner',null,null,'#aaaaaa','archived']
  ]) {
    const classId=id(`catalog-class:${key}`),disciplineId=id(`catalog-discipline:${discipline}`);
    const result=await client.query(`INSERT INTO studio_classes(id,discipline_id,name_es,audience,level,min_age,max_age,color,status,description_es)
      SELECT $1,d.id,$3,$4,$5,$6,$7,$8,CASE WHEN $9='published' AND d.status<>'published' THEN 'draft' ELSE $9 END,$10
      FROM studio_disciplines d WHERE d.id=$2 ON CONFLICT(id) DO NOTHING`,[classId,disciplineId,name,audience,level,min,max,color??'#'+randomBytes(3).toString('hex'),status,status==='published'?'Clase ficticia publicada de 55 minutos.':'']);
    created+=result.rowCount;
    // Discipline is editable catalog data: never undo or reject a manual move.
  }
  for(const [key,publicName,discipline,status] of [['yoga','Demo Public Yoga Teacher','wellness','published'],['dance','Demo Public Dance Teacher','ballet','draft']]){
    const instructorId=id(`instructor:instructor.${key}`),disciplineId=id(`catalog-discipline:${discipline}`);
    const inserted=await client.query(`INSERT INTO studio_instructor_profiles(instructor_id,public_name,biography_es,status)
      SELECT i.id,$2,'Biografía ficticia aprobada para el catálogo.',CASE WHEN $4='published' AND d.status<>'published' THEN 'draft' ELSE $4 END
      FROM instructors i JOIN people p ON p.id=i.person_id AND p.status='active'
      JOIN accounts a ON a.person_id=p.id AND a.status='active' AND a.confirmation_status IN ('verified','exempt')
      JOIN studio_disciplines d ON d.id=$3 WHERE i.id=$1 AND EXISTS(SELECT 1 FROM account_roles r WHERE r.account_id=a.id AND r.role='instructor')
      ON CONFLICT(instructor_id) DO NOTHING`,[instructorId,publicName,disciplineId,status]);
    if(inserted.rowCount){
      await client.query('INSERT INTO studio_instructor_disciplines(instructor_id,discipline_id) VALUES($1,$2)',[instructorId,disciplineId]);
      if(key==='yoga'){
        const portrait=await sharp({create:{width:128,height:128,channels:3,background:'#d8ccec'}}).webp().toBuffer();
        await client.query(`INSERT INTO studio_instructor_photos(instructor_id,data,alt_es) VALUES($1,$2,$3)`,[instructorId,portrait,'Ilustración ficticia de color lila; no es una persona real.']);
      }
      created++;
    }
    // Seed qualifications only with a new profile; a removed manual qualification stays removed.
  }
  if(created)await client.query(`INSERT INTO audit_events(actor_id,actor_type,action,target_type,target_id,business_unit,changes,reason,correlation_id)
    VALUES ('development-demo-script','system','studio.demo_seeded','dataset','conecta-catalog-demo-v1','studio',$1,
      'Fictional catalog fixtures with explicit public facts; no legacy adoption, bookings or private media',$2)`,[JSON.stringify({created}),randomUUID()]);
  return {catalogDisciplines:3,catalogClasses:6,catalogInstructors:2};
}
