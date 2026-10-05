import express,{type RequestHandler} from 'express';
import type {createFamilyInvitationService} from './family-invitations.js';
import type {createFamilyResponsibilityService} from './family-responsibility.js';
import {failure,readSessionCookie} from './auth-routes.js';

export function createFamilyRouter(service:ReturnType<typeof createFamilyInvitationService>,mutationGuard:RequestHandler,responsibility?:ReturnType<typeof createFamilyResponsibilityService>){
  if(typeof mutationGuard!=='function')throw new Error('FAMILY_MUTATION_GUARD_REQUIRED');
  const router=express.Router();router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
  // Do not parse action tokens before the trusted Origin/session/CSRF boundary.
  router.use((req,res,next)=>req.method==='POST'?mutationGuard(req,res,next):next());
  router.use(express.json({limit:'2kb'}));
  if(responsibility){
    router.get('/:id/responsibility',async(req,res)=>{try{res.json(await responsibility.state(req.params.id,readSessionCookie(req.headers.cookie)));}catch(error){failure(res,error);}});
    router.post('/:id/successor-offers',async(req,res)=>{try{res.status(202).json(await responsibility.nominate(req.params.id,req.body,readSessionCookie(req.headers.cookie),req.socket.remoteAddress??''));}catch(error){failure(res,error);}});
    router.post('/successor-offers/preview',async(req,res)=>{try{res.json(await responsibility.preview(req.body,readSessionCookie(req.headers.cookie)));}catch(error){failure(res,error);}});
    for(const action of ['accept','decline'] as const)router.post('/successor-offers/'+action,async(req,res)=>{try{res.json(await responsibility[action](req.body,readSessionCookie(req.headers.cookie),req.socket.remoteAddress??''));}catch(error){failure(res,error);}});
  }
  router.get('/current',async(req,res)=>{try{res.json(await service.current(readSessionCookie(req.headers.cookie)));}catch(error){failure(res,error);}});
  router.get('/for-account/:id',async(req,res)=>{try{res.json(await service.forAccount(req.params.id,readSessionCookie(req.headers.cookie)));}catch(error){failure(res,error);}});
  router.get('/:id',async(req,res)=>{try{res.json(await service.get(req.params.id,readSessionCookie(req.headers.cookie)));}catch(error){failure(res,error);}});
  router.post('/',async(req,res)=>{try{res.status(201).json(await service.create(req.body,readSessionCookie(req.headers.cookie)));}catch(error){failure(res,error);}});
  router.post('/:id/invitations',async(req,res)=>{try{res.status(202).json(await service.invite(req.params.id,req.body,readSessionCookie(req.headers.cookie),req.socket.remoteAddress??''));}catch(error){failure(res,error);}});
  router.post('/invitations/preview',async(req,res)=>{try{res.json(await service.preview(req.body,readSessionCookie(req.headers.cookie)));}catch(error){failure(res,error);}});
  router.post('/invitations/accept',async(req,res)=>{try{res.json(await service.accept(req.body,readSessionCookie(req.headers.cookie),req.socket.remoteAddress??''));}catch(error){failure(res,error);}});
  router.use((_req,res)=>{res.status(404).json({code:'NOT_FOUND'});});
  router.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
    const status=error&&typeof error==='object'&&'status'in error?error.status:undefined;
    if(status===400||status===413){res.status(status).json({code:'INVALID_REQUEST'});return;}failure(res,error);
  });
  return router;
}
