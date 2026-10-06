import express, {type RequestHandler} from 'express';
import {failure,readSessionCookie} from './auth-routes.js';
import type {createProfileService} from './profiles.js';

export function createProfileRouter(profiles:ReturnType<typeof createProfileService>,mutationGuard:RequestHandler){
  if(typeof mutationGuard!=='function')throw new Error('PROFILE_MUTATION_GUARD_REQUIRED');
  const router=express.Router();
  router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
  router.use(express.json({limit:'2kb'}));
  router.get('/',async(req,res)=>{try{res.json(await profiles.read(readSessionCookie(req.headers.cookie)));}catch(error){failure(res,error);}});
  router.post('/',mutationGuard,async(req,res)=>{try{res.json(await profiles.update(req.body,readSessionCookie(req.headers.cookie)));}catch(error){failure(res,error);}});
  router.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
    const status=error&&typeof error==='object'&&'status' in error?error.status:undefined;
    if(status===400||status===413){res.status(status).json({code:'INVALID_REQUEST'});return;}failure(res,error);
  });
  return router;
}
