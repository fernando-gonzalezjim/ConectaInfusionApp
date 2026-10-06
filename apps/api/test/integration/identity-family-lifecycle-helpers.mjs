// Controlled empty financial fixtures only. Never imported by application code.
// Preserve earlier persistence/consent assertions through the guarded lifecycle boundary.
import {executeFamilyLifecycleInTransaction} from '../../dist/modules/identity/family-lifecycle.js';
function emptyFixtureCoordinator(callback){return callback?{
  inspect:async()=>({status:'known',revision:'empty-fixture',obligations:{ownership:true,reservations:true,valueAndExpiry:true,noRefundOrRestoration:true,transactionalAudit:true}}),
  apply:async(client,plan)=>{await callback(client,plan);return {status:'applied',revision:'empty-fixture'};}
}:undefined;}
export function endFamilyMembershipInTransaction(client,input,context,callback){
  return executeFamilyLifecycleInTransaction(client,{...input,creditChoice:'keep',expectedFinancialRevision:'empty-fixture'},context,emptyFixtureCoordinator(callback));
}
export function closeFamilyInTransaction(client,input,context,callback){
  return executeFamilyLifecycleInTransaction(client,{...input,operation:'close',expectedFinancialRevision:'empty-fixture'},context,emptyFixtureCoordinator(callback));
}
