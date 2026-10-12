import express from 'express';
import {failure} from '../identity/auth-routes.js';
import type {createPublicCatalogService} from './public-read.js';

export function createPublicCatalogRouter(service:ReturnType<typeof createPublicCatalogService>){
 const router=express.Router();
 router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
 router.get('/disciplines',async(req,res)=>{try{res.json(await service.listDisciplines(req.query));}catch(error){failure(res,error);}});
 router.get('/disciplines/:id',async(req,res)=>{try{res.json(await service.discipline(req.params.id,req.query));}catch(error){failure(res,error);}});
 router.get('/classes',async(req,res)=>{try{res.json(await service.listClasses(req.query));}catch(error){failure(res,error);}});
 router.get('/classes/:id',async(req,res)=>{try{res.json(await service.classDetail(req.params.id,req.query));}catch(error){failure(res,error);}});
 return router;
}
