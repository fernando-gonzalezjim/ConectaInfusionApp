import express,{type RequestHandler} from 'express';
import type {createDeactivationService} from './deactivation.js';
import {failure,readSessionCookie} from './auth-routes.js';
export function createDeactivationRouter(service:ReturnType<typeof createDeactivationService>,guard:RequestHandler){
  if(typeof guard!=='function')throw new Error('DEACTIVATION_MUTATION_GUARD_REQUIRED');
  const router=express.Router();
  for(const [path,operation] of [['/:id/deactivation/preview',service.preview],['/:id/deactivation',service.execute]] as const){
    router.post(path,(_req,res,next)=>{res.set('Cache-Control','no-store');next();},guard,express.json({limit:'8kb'}),async(req,res)=>{try{res.json(await operation(req.params.id,req.body,readSessionCookie(req.headers.cookie)));}catch(error){failure(res,error);}});
  }
  router.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{const status=error&&typeof error==='object'&&'status'in error?error.status:undefined;if(status===400||status===413){res.status(status).json({code:'INVALID_REQUEST'});return;}failure(res,error);});
  return router;
}
