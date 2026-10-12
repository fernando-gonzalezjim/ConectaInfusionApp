import express,{type RequestHandler} from 'express';
import {failure,readSessionCookie} from '../identity/auth-routes.js';
import type {createDisciplineService} from './disciplines.js';

export function createDisciplineRouter(service:ReturnType<typeof createDisciplineService>,mutationGuard:RequestHandler){
  if(typeof mutationGuard!=='function')throw new Error('STUDIO_MUTATION_GUARD_REQUIRED');
  const router=express.Router();
  router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
  router.use((req,res,next)=>req.method==='POST'?mutationGuard(req,res,next):next());
  router.use(express.json({limit:'40kb'}));
  router.get('/',async(req,res)=>{try{res.json(await service.list(req.query,readSessionCookie(req.headers.cookie)));}catch(error){failure(res,error);}});
  router.post('/',async(req,res)=>{try{res.status(201).json(await service.create(req.body,readSessionCookie(req.headers.cookie)));}catch(error){failure(res,error);}});
  router.post('/:id',async(req,res)=>{try{res.json(await service.update(req.params.id,req.body,readSessionCookie(req.headers.cookie)));}catch(error){failure(res,error);}});
  router.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
    if(error&&typeof error==='object'&&'status' in error&&[400,413].includes(Number(error.status)))res.status(Number(error.status)).json({code:'INVALID_REQUEST'});
    else failure(res,error);
  });
  return router;
}
