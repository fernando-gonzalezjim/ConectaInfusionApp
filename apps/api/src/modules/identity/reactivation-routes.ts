import express,{type RequestHandler} from 'express';
import type {createReactivationService} from './reactivation.js';
import type {createGuardianReactivationService} from './guardian-reactivation.js';
import {failure,readSessionCookie} from './auth-routes.js';
export function createReactivationRouter(accounts:ReturnType<typeof createReactivationService>,guardians:ReturnType<typeof createGuardianReactivationService>,guard:RequestHandler,kind:'accounts'|'dependents'){
 if(typeof guard!=='function')throw new Error('REACTIVATION_MUTATION_GUARD_REQUIRED');const router=express.Router();
 const operations=kind==='accounts'?[['/:id/reactivation',(req:express.Request)=>accounts.account(req.params.id,req.body,readSessionCookie(req.headers.cookie))]] as const:
  [['/:id/reactivation/invitations',(req:express.Request)=>guardians.invite(req.params.id,req.body,readSessionCookie(req.headers.cookie),req.socket.remoteAddress??'')],['/reactivation-invitations/preview',(req:express.Request)=>guardians.preview(req.body,readSessionCookie(req.headers.cookie))],['/reactivation-invitations/accept',(req:express.Request)=>guardians.accept(req.body,readSessionCookie(req.headers.cookie),req.socket.remoteAddress??'')],['/:id/reactivation',(req:express.Request)=>guardians.complete(req.params.id,req.body,readSessionCookie(req.headers.cookie))]] as const;
 for(const [path,operation] of operations)router.post(path,(_req,res,next)=>{res.set('Cache-Control','no-store');next();},guard,express.json({limit:'2kb'}),async(req,res)=>{try{const result=await operation(req);res.status(path.endsWith('/invitations')?202:200).json(result);}catch(e){failure(res,e);}});
 router.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{const status=error&&typeof error==='object'&&'status'in error?error.status:undefined;if(status===400||status===413){res.status(status).json({code:'INVALID_REQUEST'});return;}failure(res,error);});return router;
}
