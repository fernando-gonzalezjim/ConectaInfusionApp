import express,{type RequestHandler} from 'express';
import type {createDependentTransitionService} from './dependent-transition.js';
import {failure,readSessionCookie} from './auth-routes.js';
export function createDependentTransitionRouter(service:ReturnType<typeof createDependentTransitionService>,sessionGuard:RequestHandler,anonymousGuard:RequestHandler){
  const router=express.Router(),json=express.json({limit:'2kb'});
  router.post('/:id/transition',sessionGuard,json,async(req,res)=>{try{res.status(202).json(await service.request(req.params.id,req.body,readSessionCookie(req.headers.cookie),req.ip??'unknown'));}catch(error){failure(res,error);}});
  router.post('/transitions/complete',anonymousGuard,json,async(req,res)=>{try{res.json(await service.complete(req.body,req.ip??'unknown'));}catch(error){failure(res,error);}});
  router.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{const status=error&&typeof error==='object'&&'status'in error?error.status:undefined;if(status===400||status===413){res.status(status).json({code:'INVALID_REQUEST'});return;}failure(res,error);});
  return router;
}
