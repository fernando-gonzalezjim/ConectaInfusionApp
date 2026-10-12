import express,{type RequestHandler} from 'express';
import {failure,readSessionCookie} from '../identity/auth-routes.js';
import type {createInstructorPhotoService} from './instructor-photos.js';
export function createInstructorPhotoRouter(service:ReturnType<typeof createInstructorPhotoService>,guard:RequestHandler){
 if(typeof guard!=='function')throw new Error('STUDIO_MUTATION_GUARD_REQUIRED');const router=express.Router();
 router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
 router.get('/:id/photo',async(req,res)=>{try{res.type('image/webp').set('X-Content-Type-Options','nosniff').send(await service.readManagement(req.params.id,readSessionCookie(req.headers.cookie)));}catch(e){failure(res,e);}});
 router.post('/:id/photo',guard,express.json({limit:7*1024*1024}),async(req,res)=>{try{res.json(await service.upload(req.params.id,req.body,readSessionCookie(req.headers.cookie)));}catch(e){failure(res,e);}});
 router.post('/:id/photo/remove',guard,express.json({limit:'4kb'}),async(req,res)=>{try{res.json(await service.remove(req.params.id,req.body,readSessionCookie(req.headers.cookie)));}catch(e){failure(res,e);}});
 router.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
  if(error&&typeof error==='object'&&'status' in error&&[400,413].includes(Number(error.status)))res.status(Number(error.status)).json({code:'INVALID_REQUEST'});else failure(res,error);
 });return router;
}
export function createPublicInstructorPhotoRouter(service:ReturnType<typeof createInstructorPhotoService>){
 const router=express.Router();router.get('/instructors/:id/photo',async(req,res)=>{res.set('Cache-Control','no-store');try{res.type('image/webp').set('X-Content-Type-Options','nosniff').send(await service.readPublic(req.params.id));}catch(e){failure(res,e);}});return router;
}
