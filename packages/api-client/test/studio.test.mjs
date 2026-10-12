import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiClient} from '../src/index.ts';

const discipline={id:'11111111-1111-4111-8111-111111111111',nameEs:'Yoga',nameEn:null,descriptionEs:'',descriptionEn:null,status:'draft',version:1};
test('discipline client binds mutation CSRF and preserves safe revision-bound DTOs',async()=>{
  const calls=[];
  const api=createApiClient('',async(url,options)=>{
    calls.push({url,options});
    if(url==='/auth/session')return Response.json({csrfToken:'fresh'});
    if(options.method==='POST')return Response.json({...discipline,privateStoragePath:'must be omitted'});
    return Response.json({items:[discipline],nextCursor:null});
  });
  assert.deepEqual(await api.listStudioDisciplines(),{items:[discipline],nextCursor:null});
  assert.deepEqual(await api.createStudioDiscipline({nameEs:'Yoga'}),discipline);
  assert.deepEqual(await api.updateStudioDiscipline(discipline.id,{status:'archived',expectedVersion:1}),discipline);
  assert.equal(calls[2].options.headers['X-CSRF-Token'],'fresh');
  assert.equal(calls[4].options.headers['X-CSRF-Token'],'fresh');
  assert.deepEqual(JSON.parse(calls[4].options.body),{status:'archived',expectedVersion:1});
  await assert.rejects(api.updateStudioDiscipline('bad/path',{expectedVersion:1}),{code:'INVALID_REQUEST'});
  await assert.rejects(api.listStudioDisciplines({limit:51}),{code:'INVALID_REQUEST'});
});
test('discipline client rejects malformed server pages and preserves conflict without retrying',async()=>{
  const invalid=createApiClient('',async()=>Response.json({items:[{...discipline,version:0}],nextCursor:null}));
  await assert.rejects(invalid.listStudioDisciplines(),{code:'INTERNAL_ERROR'});
  let writes=0;
  const conflict=createApiClient('',async url=>{
    if(url==='/auth/session')return Response.json({csrfToken:'fresh'});
    writes++;return Response.json({code:'CONFLICT'},{status:409});
  });
  await assert.rejects(conflict.updateStudioDiscipline(discipline.id,{expectedVersion:1}),{code:'CONFLICT'});
  assert.equal(writes,1);
});
