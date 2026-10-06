import express,{type RequestHandler} from 'express';
import type {createLifecycleReadService} from './lifecycle-read.js';
import {failure,readSessionCookie} from './auth-routes.js';
export function createLifecycleReadRouter(service:ReturnType<typeof createLifecycleReadService>,kind:'accounts'|'dependents',origin:RequestHandler){
 const router=express.Router();router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});router.use(origin);
 if(kind==='accounts')router.get('/:id/lifecycle',async(req,res)=>{try{res.json(await service.account(req.params.id,readSessionCookie(req.headers.cookie)));}catch(e){failure(res,e);}});
 else{
  router.get('/reactivation-candidates',async(req,res)=>{try{res.json(await service.candidates(req.query,readSessionCookie(req.headers.cookie)));}catch(e){failure(res,e);}});
  router.get('/:id/reactivation/state',async(req,res)=>{try{res.json(await service.dependent(req.params.id,readSessionCookie(req.headers.cookie)));}catch(e){failure(res,e);}});
 }
 return router;
}
