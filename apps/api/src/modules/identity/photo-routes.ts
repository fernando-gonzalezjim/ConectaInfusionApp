import express,{type RequestHandler} from 'express';
import {failure,readSessionCookie} from './auth-routes.js';
import type {createPhotoService} from './photos.js';

export function createPhotoRouter(photos:ReturnType<typeof createPhotoService>,mutationGuard:RequestHandler,own:boolean){
  if(typeof mutationGuard!=='function')throw new Error('PHOTO_MUTATION_GUARD_REQUIRED');
  const router=express.Router(),path=own?'/photo':'/:id/photo';
  router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
  router.get(path,async(req:express.Request,res)=>{try{const data=await photos.read(own?undefined:req.params.id,readSessionCookie(req.headers.cookie));
    res.type('image/webp').set('X-Content-Type-Options','nosniff').send(data);}catch(error){failure(res,error);}});
  router.post(path,mutationGuard,express.json({limit:7*1024*1024}),async(req,res)=>{
    try{res.json(await photos.upload(own?undefined:req.params.id,req.body,readSessionCookie(req.headers.cookie)));}catch(error){failure(res,error);}
  });
  router.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
    const status=error&&typeof error==='object'&&'status' in error?error.status:undefined;
    if(status===400||status===413){res.status(status).json({code:'INVALID_REQUEST'});return;}failure(res,error);
  });return router;
}
