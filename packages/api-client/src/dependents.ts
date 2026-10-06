import type {DependentProfileView,DependentProfileInput,SavedChildView,SavedChildInput,IdentityPage,GuardianInviteTarget,GuardianInvitationPreview,GuardianInvitationAccepted,ActionAcceptedResponse,GuardianRemovalTarget,GuardianRemovedResponse} from '@conecta/contracts';
type Read=<T>(path:string,signal?:AbortSignal)=>Promise<T>;
type Write=<T>(path:string,input:unknown,signal?:AbortSignal)=>Promise<T>;
type Query={limit?:number;cursor?:string};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const identifier=(value:unknown):value is string=>typeof value==='string'&&uuid.test(value);
const text=(value:unknown,max:number):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\x00-\x1f\x7f]/.test(value);
const version=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=2147483647;
export function createDependentClient(read:Read,write:Write,error:(code:'INVALID_REQUEST'|'INTERNAL_ERROR')=>Error){
  function id(value:string){if(!identifier(value))throw error('INVALID_REQUEST');return value;}
  function dependent(value:DependentProfileView):DependentProfileView{
    if(!value||!identifier(value.id)||!text(value.fullName,120)||!text(value.ageText,40)||!['es-MX','en'].includes(value.preferredLocale)||!version(value.version)
      ||!Array.isArray(value.guardians)||!value.guardians.length||value.guardians.some(g=>!g||!identifier(g.accountId)||!text(g.fullName,120))
      ||new Set(value.guardians.map(g=>g.accountId)).size!==value.guardians.length)throw error('INTERNAL_ERROR');
    return {id:value.id,fullName:value.fullName,ageText:value.ageText,preferredLocale:value.preferredLocale,version:value.version,guardians:value.guardians.map(g=>({accountId:g.accountId,fullName:g.fullName}))};
  }
  function child(value:SavedChildView):SavedChildView{
    if(!value||!identifier(value.id)||!text(value.childName,120)||!text(value.ageText,40)||!version(value.version)||!(value.dependentPersonId===null||identifier(value.dependentPersonId)))throw error('INTERNAL_ERROR');
    return {id:value.id,childName:value.childName,ageText:value.ageText,dependentPersonId:value.dependentPersonId,version:value.version};
  }
  function target(value:GuardianInviteTarget):GuardianInviteTarget{
    if(!value||!identifier(value.id)||!text(value.fullName,120))throw error('INTERNAL_ERROR');return {id:value.id,fullName:value.fullName};
  }
  async function page<T>(path:string,query:Query,project:(value:T)=>T,signal?:AbortSignal):Promise<IdentityPage<T>>{
    const limit=query.limit??25;
    if(!Number.isSafeInteger(limit)||limit<1||limit>50||query.cursor!==undefined&&!identifier(query.cursor))throw error('INVALID_REQUEST');
    const params=new URLSearchParams({limit:String(limit)});if(query.cursor)params.set('cursor',query.cursor);
    const result=await read<IdentityPage<T>>(path+'?'+params,signal);
    if(!result||!Array.isArray(result.items)||result.items.length>limit||!(result.nextCursor===null||identifier(result.nextCursor)))throw error('INTERNAL_ERROR');
    return {items:result.items.map(project),nextCursor:result.nextCursor};
  }
  return {
    requestDependentTransition:async(value:string,input:{email:string},signal?:AbortSignal)=>{
      const result=await write<ActionAcceptedResponse>('/dependents/'+id(value)+'/transition',input,signal);
      if(!result||result.code!=='ACCEPTED')throw error('INTERNAL_ERROR');return {code:'ACCEPTED'} as const;
    },
    listGuardians:(value:string,query:Query={},signal?:AbortSignal)=>page<GuardianRemovalTarget>('/dependents/'+id(value)+'/guardians',query,entry=>{
      if(!entry||!identifier(entry.id)||!identifier(entry.accountId)||!text(entry.fullName,120)||typeof entry.canRemove!=='boolean')throw error('INTERNAL_ERROR');
      return {id:entry.id,accountId:entry.accountId,fullName:entry.fullName,canRemove:entry.canRemove};
    },signal),
    removeGuardian:async(value:string,relationship:string,signal?:AbortSignal):Promise<GuardianRemovedResponse>=>{
      const result=await write<GuardianRemovedResponse>('/dependents/'+id(value)+'/guardians/'+id(relationship)+'/remove',{},signal);
      if(!result||result.dependentId!==value.toLowerCase()||result.guardianRelationshipId!==relationship.toLowerCase()||!identifier(result.dependentId)||!identifier(result.guardianRelationshipId))throw error('INTERNAL_ERROR');return {dependentId:result.dependentId,guardianRelationshipId:result.guardianRelationshipId};
    },
    listGuardianInviteTargets:(value:string,query:Query={},signal?:AbortSignal)=>page('/dependents/guardian-invitations/for-account/'+id(value),query,target,signal),
    inviteGuardian:async(value:string,input:{email:string},signal?:AbortSignal)=>{
      const result=await write<ActionAcceptedResponse>('/dependents/'+id(value)+'/guardian-invitations',input,signal);
      if(!result||result.code!=='ACCEPTED')throw error('INTERNAL_ERROR');return {code:'ACCEPTED'} as const;
    },
    previewGuardianInvitation:async(input:{token:string},signal?:AbortSignal):Promise<GuardianInvitationPreview>=>{
      const result=await write<GuardianInvitationPreview>('/dependents/guardian-invitations/preview',input,signal);
      if(!result||typeof result.expiresAt!=='string'||result.expiresAt.length>32||!Number.isFinite(Date.parse(result.expiresAt)))throw error('INTERNAL_ERROR');
      return {dependent:target(result.dependent),expiresAt:result.expiresAt};
    },
    acceptGuardianInvitation:async(input:{token:string},signal?:AbortSignal):Promise<GuardianInvitationAccepted>=>{
      const result=await write<GuardianInvitationAccepted>('/dependents/guardian-invitations/accept',input,signal);
      if(!result||!identifier(result.dependentId))throw error('INTERNAL_ERROR');return {dependentId:result.dependentId};
    },
    listDependents:(query:Query={},signal?:AbortSignal)=>page('/dependents',query,dependent,signal),
    getDependent:async(value:string,signal?:AbortSignal)=>dependent(await read<DependentProfileView>('/dependents/'+id(value),signal)),
    createDependent:async(input:DependentProfileInput,signal?:AbortSignal)=>dependent(await write<DependentProfileView>('/dependents',input,signal)),
    updateDependent:async(value:string,input:DependentProfileInput&{expectedVersion:number},signal?:AbortSignal)=>dependent(await write<DependentProfileView>('/dependents/'+id(value),input,signal)),
    listChildDetails:(query:Query={},signal?:AbortSignal)=>page('/child-details',query,child,signal),
    getChildDetails:async(value:string,signal?:AbortSignal)=>child(await read<SavedChildView>('/child-details/'+id(value),signal)),
    createChildDetails:async(input:SavedChildInput,signal?:AbortSignal)=>child(await write<SavedChildView>('/child-details',input,signal)),
    updateChildDetails:async(value:string,input:SavedChildInput&{expectedVersion:number},signal?:AbortSignal)=>child(await write<SavedChildView>('/child-details/'+id(value),input,signal)),
    convertChildDetails:async(value:string,input:{expectedVersion:number},signal?:AbortSignal)=>{
      const result=await write<{child:SavedChildView;dependent:DependentProfileView}>('/child-details/'+id(value)+'/convert',input,signal);
      if(!result)throw error('INTERNAL_ERROR');const saved=child(result.child),profile=dependent(result.dependent);
      if(saved.dependentPersonId!==profile.id)throw error('INTERNAL_ERROR');return {child:saved,dependent:profile};
    }
  };
}
