import express,{type RequestHandler} from 'express';
import type {createChildDetailsService} from './child-details.js';
import type {createGuardianInvitationService} from './guardian-invitations.js';
import type {createGuardianService} from './guardians.js';
import {failure,readSessionCookie} from './auth-routes.js';
export function createDependentRouter(service:ReturnType<typeof createChildDetailsService>,mutationGuard:RequestHandler,kind:'dependents'|'child-details',guardians:ReturnType<typeof createGuardianInvitationService>,removal:ReturnType<typeof createGuardianService>){
  if(typeof mutationGuard!=='function')throw new Error('DEPENDENT_MUTATION_GUARD_REQUIRED');
  const router=express.Router();router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
  router.use((req,res,next)=>req.method==='POST'?mutationGuard(req,res,next):next());router.use(express.json({limit:'2kb'}));
  if(kind==='dependents'){
    router.get('/:id/guardians',async(req,res)=>{try{res.json(await removal.list(req.params.id,req.query,readSessionCookie(req.headers.cookie)));}catch(error){failure(res,error);}});
    router.post('/:id/guardians/:relationshipId/remove',async(req,res)=>{try{res.json(await removal.remove(req.params.id,req.params.relationshipId,req.body,readSessionCookie(req.headers.cookie)));}catch(error){failure(res,error);}});
    router.get('/guardian-invitations/for-account/:accountId',async(req,res)=>{try{res.json(await guardians.assistTargets(req.params.accountId,req.query,readSessionCookie(req.headers.cookie)));}catch(error){failure(res,error);}});
    router.post('/guardian-invitations/preview',async(req,res)=>{try{res.json(await guardians.preview(req.body,readSessionCookie(req.headers.cookie)));}catch(error){failure(res,error);}});
    router.post('/guardian-invitations/accept',async(req,res)=>{try{res.json(await guardians.accept(req.body,readSessionCookie(req.headers.cookie),req.ip??'unknown'));}catch(error){failure(res,error);}});
    router.post('/:id/guardian-invitations',async(req,res)=>{try{res.status(202).json(await guardians.invite(req.params.id,req.body,readSessionCookie(req.headers.cookie),req.ip??'unknown'));}catch(error){failure(res,error);}});
  }
  router.get('/',async(req,res)=>{try{res.json(await (kind==='dependents'?service.listDependents:service.listChildren)(req.query,readSessionCookie(req.headers.cookie)));}catch(error){failure(res,error);}});
  router.get('/:id',async(req,res)=>{try{res.json(await (kind==='dependents'?service.getDependent:service.getChild)(req.params.id,readSessionCookie(req.headers.cookie)));}catch(error){failure(res,error);}});
  router.post('/',async(req,res)=>{try{res.status(201).json(await (kind==='dependents'?service.createDependent:service.createChild)(req.body,readSessionCookie(req.headers.cookie)));}catch(error){failure(res,error);}});
  router.post('/:id',async(req,res)=>{try{res.json(await (kind==='dependents'?service.updateDependent:service.updateChild)(req.params.id,req.body,readSessionCookie(req.headers.cookie)));}catch(error){failure(res,error);}});
  if(kind==='child-details')router.post('/:id/convert',async(req,res)=>{try{res.status(201).json(await service.convertChild(req.params.id,req.body,readSessionCookie(req.headers.cookie)));}catch(error){failure(res,error);}});
  router.use((_req,res)=>{res.status(404).json({code:'NOT_FOUND'});});
  router.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{const status=error&&typeof error==='object'&&'status'in error?error.status:undefined;if(status===400||status===413){res.status(status).json({code:'INVALID_REQUEST'});return;}failure(res,error);});
  return router;
}
