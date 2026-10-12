import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiClient} from '../src/index.ts';
const id='11111111-1111-4111-8111-111111111111';
const item={id,disciplineId:id,nameEs:'Yoga',nameEn:null,descriptionEs:'Yoga description',descriptionEn:null,status:'published',version:1,audience:'adults',minAge:null,maxAge:null,level:'all',color:'#FFFFFF',durationMinutes:55};
test('catalog client isolates public/private DTOs and binds staff color mutations to fresh CSRF',async()=>{
 const calls=[];const api=createApiClient('',async(url,options)=>{calls.push({url,options});if(url==='/auth/session')return Response.json({csrfToken:'fresh'});
 if(url.includes('/catalog/classes'))return Response.json({items:[{...item,name:'Yoga',description:'Yoga description',discipline:{id,name:'Yoga',description:'Movement'},instructors:[],email:'private'}],nextCursor:null});
 return Response.json(options.method==='POST'?{...item,email:'private'}:{items:[item],nextCursor:null});});
 assert.deepEqual(await api.listStudioClasses(),{items:[item],nextCursor:null});
 assert.deepEqual(await api.updateStudioClassColor(id,{color:'#FFFFFF',expectedVersion:1}),item);
 assert.equal(calls[2].options.headers['X-CSRF-Token'],'fresh');
 const page=await api.listPublicClasses({locale:'en',disciplineId:id});assert.equal(page.items[0].name,'Yoga');assert.equal(page.items[0].email,undefined);assert.equal(page.items[0].version,undefined);
 assert.ok(calls.at(-1).url.includes('locale=en'));
 await assert.rejects(async()=>api.listPublicClasses({limit:51}),{code:'INVALID_REQUEST'});
});
test('catalog client rejects invalid colors, duration, instructor identity and public pagination',async()=>{
 const malformed=createApiClient('',async()=>Response.json({items:[{...item,durationMinutes:60}],nextCursor:null}));
 await assert.rejects(malformed.listStudioClasses(),{code:'INTERNAL_ERROR'});
 const api=createApiClient('',async()=>Response.json({items:[],nextCursor:'invalid'}));
 await assert.rejects(api.listPublicClasses(),{code:'INTERNAL_ERROR'});
 await assert.rejects(async()=>api.updateStudioClassColor('../secret',{color:'#FFFFFF',expectedVersion:1}),{code:'INVALID_REQUEST'});
});
