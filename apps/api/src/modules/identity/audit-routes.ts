import express from 'express';
import {failure,readSessionCookie} from './auth-routes.js';
import type {createAuditViewService} from './audit-view.js';
export function createAuditRouter(audit:ReturnType<typeof createAuditViewService>){
  const router=express.Router();router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
  router.get('/',async(req,res)=>{try{res.json(await audit.list(req.query,readSessionCookie(req.headers.cookie)));}catch(error){failure(res,error);}});
  router.use((_req,res)=>{res.status(404).json({code:'NOT_FOUND'});});return router;
}
