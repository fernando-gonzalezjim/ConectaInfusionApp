import type { ApiErrorCode, CsrfResponse, LoginInput, LoginResponse, SessionResponse, PublicSettings, StudioOverview, ManagementAccessResponse, RegistrationInput, ActionAcceptedResponse, EmailConfirmedResponse, PasswordResetInput, PasswordResetResponse, CustomerInvitationInput, PasswordSetupResponse } from '@conecta/contracts';
import type {AccountListQuery,AccountListResponse,AccountProfile,AccountProfileInput,IdentityRole,RoleChangeInput,RoleChangeResponse} from '@conecta/contracts';
import {createLifecycleClient} from './lifecycle.ts';
import {createDependentClient} from './dependents.ts';

const identityRoles: readonly IdentityRole[]=['administrator','manager','reception','cafe_staff','instructor','customer'];
const validId=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
function safeFamily(value:import('@conecta/contracts').FamilyView):import('@conecta/contracts').FamilyView{
  if(!value||!validId(value.id)||!validId(value.createdByPersonId)||!(value.responsibleMembershipId===null||validId(value.responsibleMembershipId))
    ||typeof value.name!=='string'||!value.name.trim()||value.name.length>120||/[\x00-\x1f\x7f]/.test(value.name)
    ||!['active','closed'].includes(value.status)||!Number.isSafeInteger(value.version)||value.version<0||value.version>2147483647)throw new ApiError('INTERNAL_ERROR');
  return {id:value.id,name:value.name,createdByPersonId:value.createdByPersonId,responsibleMembershipId:value.responsibleMembershipId,status:value.status,version:value.version};
}
function safeRoles(value:unknown):IdentityRole[]{
  if(!Array.isArray(value)||value.length>6||new Set(value).size!==value.length||value.some(role=>!identityRoles.includes(role)))throw new ApiError('INTERNAL_ERROR');
  return [...value];
}
function safeProfile(value:AccountProfile):AccountProfile {
  if(!value||!validId(value.id)||!validId(value.personId)||typeof value.email!=='string'||value.email.length>320||typeof value.fullName!=='string'||value.fullName.length>120
    ||!(value.phone===null||typeof value.phone==='string'&&value.phone.length<=40)||!(value.photoId===null||validId(value.photoId))
    ||!['es-MX','en'].includes(value.preferredLocale)||!['pending','active','inactive'].includes(value.status)||!['active','inactive'].includes(value.profileStatus)
    ||!['pending','verified','exempt'].includes(value.confirmationStatus))throw new ApiError('INTERNAL_ERROR');
  return {id:value.id,personId:value.personId,email:value.email,fullName:value.fullName,phone:value.phone,photoId:value.photoId,preferredLocale:value.preferredLocale,
    roles:safeRoles(value.roles),status:value.status,profileStatus:value.profileStatus,confirmationStatus:value.confirmationStatus};
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly retryAfterSeconds?: number;
  constructor(code: ApiErrorCode, retryAfterSeconds?: number) { super(code); this.name = 'ApiError'; this.code = code; this.retryAfterSeconds = retryAfterSeconds; }
}

export function createApiClient(baseUrl = '/api/v1', request: typeof fetch = fetch) {
  function csrfToken(value: CsrfResponse): string {
    if (!value || typeof value.csrfToken !== 'string' || value.csrfToken.length > 150 || !/^[A-Za-z0-9_.-]+$/.test(value.csrfToken)) throw new ApiError('INTERNAL_ERROR');
    return value.csrfToken;
  }
  async function send<T>(path: string, signal?: AbortSignal, mutation?: { body: unknown; csrfToken: string }): Promise<T> {
    let response: Response;
    try { response = await request(`${baseUrl.replace(/\/$/, '')}${path}`, {
      signal, credentials: 'include', redirect: 'error',
      ...(mutation ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': mutation.csrfToken }, body: JSON.stringify(mutation.body) } : {})
    }); }
    catch (error) { if (signal?.aborted) throw error; throw new ApiError('UNAVAILABLE'); }
    if (!response.ok) {
      let body: { code?: unknown } = {};
      try { body = await response.json() as typeof body; } catch { /* Never expose raw error text. */ }
      const code: ApiErrorCode = response.status === 401 ? (body?.code === 'INVALID_CREDENTIALS' ? 'INVALID_CREDENTIALS' : 'UNAUTHENTICATED')
        : response.status === 403 ? (body?.code === 'RECENT_AUTH_REQUIRED' ? 'RECENT_AUTH_REQUIRED' : 'FORBIDDEN') : response.status === 429 ? 'THROTTLED'
        : response.status === 404 ? 'NOT_FOUND' : response.status === 409 ? 'CONFLICT' : response.status >= 500 ? 'UNAVAILABLE'
        : response.status === 400 && ['/dependents/reactivation-invitations/preview','/dependents/reactivation-invitations/accept','/dependents/transitions/complete', '/auth/confirmation', '/auth/recovery/reset', '/auth/setup', '/auth/email-change/confirmation','/dependents/guardian-invitations/preview','/dependents/guardian-invitations/accept','/families/invitations/preview','/families/invitations/accept','/families/successor-offers/preview','/families/successor-offers/accept','/families/successor-offers/decline'].includes(path) && body?.code === 'INVALID_ACTION' ? 'INVALID_ACTION' : 'INVALID_REQUEST';
      const retry = response.headers.get('Retry-After');
      const seconds = retry && /^[1-9][0-9]{0,6}$/.test(retry) ? Number(retry) : undefined;
      throw new ApiError(code, code === 'THROTTLED' ? seconds : undefined);
    }
    if (response.status === 204) return undefined as T;
    try { return await response.json() as T; }
    catch { throw new ApiError('INTERNAL_ERROR'); }
  }
  async function anonymousAction<T extends 'ACCEPTED' | 'CONFIRMED' | 'PASSWORD_RESET' | 'PASSWORD_SET' | 'EMAIL_CHANGED' | 'TRANSITIONED'>(path: string, body: unknown, code: T, signal?: AbortSignal): Promise<{ code: T }> {
    const csrf = await send<CsrfResponse>('/auth/csrf', signal);
    const response = await send<{ code: T }>(path, signal, { body, csrfToken: csrfToken(csrf) });
    if (!response || response.code !== code) throw new ApiError('INTERNAL_ERROR');
    return { code };
  }
  async function invitation(path: string, input: unknown, signal?: AbortSignal): Promise<ActionAcceptedResponse> {
    const session = await send<SessionResponse>('/auth/session', signal);
    const response = await send<ActionAcceptedResponse>(path, signal, { body: input, csrfToken: csrfToken(session) });
    if (!response || response.code !== 'ACCEPTED') throw new ApiError('INTERNAL_ERROR');
    return { code: 'ACCEPTED' };
  }
  async function photo(path:string,signal?:AbortSignal):Promise<Blob>{
    let response:Response;
    try{response=await request(`${baseUrl.replace(/\/$/,'')}${path}`,{signal,credentials:'include',redirect:'error'});}
    catch(error){if(signal?.aborted)throw error;throw new ApiError('UNAVAILABLE');}
    if(!response.ok)throw new ApiError(response.status===401?'UNAUTHENTICATED':response.status===403?'FORBIDDEN':response.status===404?'NOT_FOUND':'UNAVAILABLE');
    if(response.headers.get('Content-Type')?.split(';')[0]!=='image/webp')throw new ApiError('INTERNAL_ERROR');
    const result=await response.blob();if(result.size>1024*1024||!result.size)throw new ApiError('INTERNAL_ERROR');return result;
  }
  async function accountMutation<T>(id:string,kind:'profile'|'roles'|'photo',input:unknown,signal?:AbortSignal):Promise<T>{
    if(!validId(id))throw new ApiError('INVALID_REQUEST');
    const session=await send<SessionResponse>('/auth/session',signal);
    return send<T>(`/accounts/${id}/${kind}`,signal,{body:input,csrfToken:csrfToken(session)});
  }
  async function familyRead(path:string,signal?:AbortSignal):Promise<{family:import('@conecta/contracts').FamilyView|null}>{
    const result=await send<{family:import('@conecta/contracts').FamilyView|null}>(path,signal);
    if(!result||!Object.hasOwn(result,'family'))throw new ApiError('INTERNAL_ERROR');return {family:result.family===null?null:safeFamily(result.family)};
  }
  async function familyMutation<T>(path:string,input:unknown,signal?:AbortSignal):Promise<T>{
    const session=await send<SessionResponse>('/auth/session',signal);return send<T>(path,signal,{body:input,csrfToken:csrfToken(session)});
  }
  async function familyPreview(path:string,input:import('@conecta/contracts').FamilyInvitationActionInput,signal?:AbortSignal):Promise<import('@conecta/contracts').FamilyInvitationPreview>{
    const result=await familyMutation<import('@conecta/contracts').FamilyInvitationPreview>(path,input,signal);
    if(!result||!result.family||!validId(result.family.id)||typeof result.family.name!=='string'||!result.family.name.trim()||result.family.name.length>120
      ||/[\x00-\x1f\x7f]/.test(result.family.name)||typeof result.expiresAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result.expiresAt)
      ||Number.isNaN(Date.parse(result.expiresAt))||new Date(result.expiresAt).toISOString()!==result.expiresAt)throw new ApiError('INTERNAL_ERROR');
    return {family:{id:result.family.id,name:result.family.name},expiresAt:result.expiresAt};
  }
  return {
    ...createDependentClient(send,familyMutation,code=>new ApiError(code)),
    ...createLifecycleClient(send,familyMutation,code=>new ApiError(code)),
    getFamilyResponsibility:async(id:string,signal?:AbortSignal):Promise<import('@conecta/contracts').FamilyResponsibilityState>=>{
      if(!validId(id))throw new ApiError('INVALID_REQUEST');const result=await send<import('@conecta/contracts').FamilyResponsibilityState>(`/families/${id}/responsibility`,signal);
      if(!result||typeof result.canNominate!=='boolean')throw new ApiError('INTERNAL_ERROR');return {canNominate:result.canNominate};
    },
    nominateFamilySuccessor:(id:string,input:import('@conecta/contracts').FamilyInvitationInput,signal?:AbortSignal)=>{if(!validId(id))throw new ApiError('INVALID_REQUEST');return invitation(`/families/${id}/successor-offers`,input,signal);},
    previewFamilySuccessor:(input:import('@conecta/contracts').FamilyInvitationActionInput,signal?:AbortSignal)=>familyPreview('/families/successor-offers/preview',input,signal),
    acceptFamilySuccessor:async(input:import('@conecta/contracts').FamilyInvitationActionInput,signal?:AbortSignal)=>safeFamily(await familyMutation<import('@conecta/contracts').FamilyView>('/families/successor-offers/accept',input,signal)),
    declineFamilySuccessor:async(input:import('@conecta/contracts').FamilyInvitationActionInput,signal?:AbortSignal)=>safeFamily(await familyMutation<import('@conecta/contracts').FamilyView>('/families/successor-offers/decline',input,signal)),
    getCurrentFamily:(signal?:AbortSignal)=>familyRead('/families/current',signal),
    getAccountFamily:(id:string,signal?:AbortSignal)=>{if(!validId(id))throw new ApiError('INVALID_REQUEST');return familyRead(`/families/for-account/${id}`,signal);},
    createFamily:async(input:import('@conecta/contracts').FamilyCreateInput,signal?:AbortSignal)=>safeFamily(await familyMutation<import('@conecta/contracts').FamilyView>('/families',input,signal)),
    inviteFamilyMember:(id:string,input:import('@conecta/contracts').FamilyInvitationInput,signal?:AbortSignal)=>{if(!validId(id))throw new ApiError('INVALID_REQUEST');return invitation(`/families/${id}/invitations`,input,signal);},
    previewFamilyInvitation:(input:import('@conecta/contracts').FamilyInvitationActionInput,signal?:AbortSignal)=>familyPreview('/families/invitations/preview',input,signal),
    acceptFamilyInvitation:async(input:import('@conecta/contracts').FamilyInvitationActionInput,signal?:AbortSignal)=>safeFamily(await familyMutation<import('@conecta/contracts').FamilyView>('/families/invitations/accept',input,signal)),
    listOperationalAudit:async(query:import('@conecta/contracts').OperationalAuditQuery={},signal?:AbortSignal):Promise<import('@conecta/contracts').OperationalAuditPage>=>{
      const params=new URLSearchParams({limit:String(query.limit??25)});if(query.cursor)params.set('cursor',query.cursor);
      const page=await send<import('@conecta/contracts').OperationalAuditPage>(`/audit?${params}`,signal);
      if(!page||!Array.isArray(page.events)||page.events.length>50||!(page.nextCursor===null||typeof page.nextCursor==='string'&&page.nextCursor.length<=200&&/^[A-Za-z0-9_-]+$/.test(page.nextCursor)))throw new ApiError('INTERNAL_ERROR');
      const actions=['identity.lifecycle_applied','dependent.deactivated','account.created','account.profile_updated','account.roles_changed','account.deactivated','account.reactivated','account.email_changed','account.email_change_requested','account.confirmation_exempted','account.password_set','settings.updated','development.demo_seeded','family.created','family.invitation_sent','family.member_joined','family.member_left','family.member_removed','family.closed','family.responsibility_offered','family.responsibility_accepted','family.responsibility_declined','dependent.created','dependent.profile_updated','child_details.created','child_details.updated','child_details.converted','dependent.guardian_invited','dependent.guardian_accepted','dependent.guardian_removed','dependent.reactivation_invited','dependent.reactivation_accepted','dependent.reactivated','dependent.transition_requested','dependent.transitioned','other'];
      const fields=['fullName','phone','preferredLocale','email','photoId','personId','status','confirmationStatus','exemptionSource','roles','displayName','country','currency','timezone','defaultLocale','supportedLocales','defaultCapacity','createdAccounts','sessions','bookings','name','version','membershipId','responsibleMembershipId','memberCount','acceptedInvitationId','invitationId','invitationVersion','guardianAccountId','guardianRelationshipId'];
      const snapshot=(value:Record<string,import('@conecta/contracts').AuditValue>|null,referencesOnly=false)=>{
        if(value===null)return null;if(!value||typeof value!=='object'||Array.isArray(value))throw new ApiError('INTERNAL_ERROR');
        const result:Record<string,import('@conecta/contracts').AuditValue>={};for(const [key,entry] of Object.entries(value)){
          if(!fields.includes(key)||referencesOnly&&!['personId','version','invitationId','invitationVersion','guardianAccountId','guardianRelationshipId'].includes(key))continue;
          if(!(entry===null||typeof entry==='boolean'||typeof entry==='number'&&Number.isFinite(entry)||typeof entry==='string'&&entry.length<=500
            ||Array.isArray(entry)&&entry.length<=6&&entry.every(item=>typeof item==='string'&&item.length<=120)))throw new ApiError('INTERNAL_ERROR');result[key]=Array.isArray(entry)?[...entry]:entry;
        }return result;
      };
      return {nextCursor:page.nextCursor,events:page.events.map(event=>{
        if(!event||!validId(event.id)||typeof event.occurredAt!=='string'||event.occurredAt.length>32||Number.isNaN(Date.parse(event.occurredAt))
          ||!['staff','customer','system'].includes(event.actorType)||!(event.actorId===null||validId(event.actorId)||event.actorId==='development-demo-script')
          ||!actions.includes(event.action)||!['lifecycle_operation','account','family','dependent','child_details','business_settings','dataset','other'].includes(event.targetType)
          ||!(event.targetId===null||validId(event.targetId)||event.targetId==='1'||event.targetId==='conecta-development-demo-v1')
          ||![event.actorName,event.targetName].every(name=>name===null||typeof name==='string'&&name.length<=120)
          ||!(event.businessUnit===null||['studio','cafe'].includes(event.businessUnit))||!(event.correctionOf===null||validId(event.correctionOf))||!event.changes)throw new ApiError('INTERNAL_ERROR');
        return {id:event.id,occurredAt:event.occurredAt,actorType:event.actorType,actorId:event.actorId,actorName:event.actorName,action:event.action,targetType:event.targetType,targetId:event.targetId,targetName:event.targetName,
          businessUnit:event.businessUnit,correctionOf:event.correctionOf,changes:{before:snapshot(event.changes.before,event.targetType==='lifecycle_operation'||event.targetType==='dependent'||event.targetType==='child_details'),after:snapshot(event.changes.after,event.targetType==='lifecycle_operation'||event.targetType==='dependent'||event.targetType==='child_details')}};
      })};
    },
    getOwnPhoto:(signal?:AbortSignal)=>photo('/me/photo',signal),
    getAccountPhoto:(id:string,signal?:AbortSignal)=>{if(!validId(id))throw new ApiError('INVALID_REQUEST');return photo(`/accounts/${id}/photo`,signal);},
    uploadOwnPhoto:async(input:import('@conecta/contracts').PhotoUploadInput,signal?:AbortSignal)=>{
      const session=await send<SessionResponse>('/auth/session',signal);
      const result=safeProfile(await send<AccountProfile>('/me/photo',signal,{body:input,csrfToken:csrfToken(session)}));
      if(result.id!==session.account.id)throw new ApiError('INTERNAL_ERROR');return result;
    },
    uploadAccountPhoto:async(id:string,input:import('@conecta/contracts').PhotoUploadInput,signal?:AbortSignal)=>{
      const result=safeProfile(await accountMutation<AccountProfile>(id,'photo',input,signal));if(result.id!==id)throw new ApiError('INTERNAL_ERROR');return result;
    },
    getOwnProfile: async(signal?:AbortSignal)=>safeProfile(await send<AccountProfile>('/me',signal)),
    updateOwnProfile: async(input:AccountProfileInput,signal?:AbortSignal)=>{
      const session=await send<SessionResponse>('/auth/session',signal);
      const result=safeProfile(await send<AccountProfile>('/me',signal,{body:input,csrfToken:csrfToken(session)}));
      if(result.id!==session.account.id)throw new ApiError('INTERNAL_ERROR');return result;
    },
    requestEmailChange: (input:{email:string},signal?:AbortSignal)=>invitation('/auth/email-change',input,signal),
    confirmEmailChange: (input:{token:string},signal?:AbortSignal)=>anonymousAction('/auth/email-change/confirmation',input,'EMAIL_CHANGED',signal),
    listAccounts: async(query:AccountListQuery={},signal?:AbortSignal):Promise<AccountListResponse>=>{
      const params=new URLSearchParams();params.set('limit',String(query.limit??25));
      if(query.cursor)params.set('cursor',query.cursor);if(query.role)params.set('role',query.role);if(query.status)params.set('status',query.status);
      const result=await send<AccountListResponse>(`/accounts?${params}`,signal);
      if(!result||!Array.isArray(result.accounts)||result.accounts.length>50||!(result.nextCursor===null||validId(result.nextCursor)))throw new ApiError('INTERNAL_ERROR');
      return {accounts:result.accounts.map(safeProfile),nextCursor:result.nextCursor};
    },
    updateAccountProfile: async(id:string,input:AccountProfileInput,signal?:AbortSignal)=>{
      const result=safeProfile(await accountMutation<AccountProfile>(id,'profile',input,signal));
      if(result.id!==id)throw new ApiError('INTERNAL_ERROR');return result;
    },
    changeAccountRoles: async(id:string,input:RoleChangeInput,signal?:AbortSignal):Promise<RoleChangeResponse>=>{
      const result=await accountMutation<RoleChangeResponse>(id,'roles',input,signal);
      if(!result||result.accountId!==id||typeof result.staffAttendanceEligible!=='boolean')throw new ApiError('INTERNAL_ERROR');
      return {accountId:result.accountId,roles:safeRoles(result.roles),staffAttendanceEligible:result.staffAttendanceEligible};
    },
    inviteCustomer: (input: CustomerInvitationInput, signal?: AbortSignal) => invitation('/accounts/invitations', input, signal),
    resendInvitation: (input: { email: string }, signal?: AbortSignal) => invitation('/accounts/invitations/resend', input, signal),
    completeDependentTransition: (input: import('@conecta/contracts').DependentTransitionInput, signal?: AbortSignal): Promise<import('@conecta/contracts').DependentTransitionResponse> => anonymousAction('/dependents/transitions/complete', input, 'TRANSITIONED', signal),
    setupPassword: (input: PasswordResetInput, signal?: AbortSignal): Promise<PasswordSetupResponse> => anonymousAction('/auth/setup', input, 'PASSWORD_SET', signal),
    requestRecovery: (input: { email: string }, signal?: AbortSignal): Promise<ActionAcceptedResponse> => anonymousAction('/auth/recovery', input, 'ACCEPTED', signal),
    resetPassword: (input: PasswordResetInput, signal?: AbortSignal): Promise<PasswordResetResponse> => anonymousAction('/auth/recovery/reset', input, 'PASSWORD_RESET', signal),
    register: (input: RegistrationInput, signal?: AbortSignal): Promise<ActionAcceptedResponse> => anonymousAction('/auth/register', input, 'ACCEPTED', signal),
    resendConfirmation: (input: { email: string }, signal?: AbortSignal): Promise<ActionAcceptedResponse> => anonymousAction('/auth/confirmation/resend', input, 'ACCEPTED', signal),
    confirmEmail: (input: { token: string }, signal?: AbortSignal): Promise<EmailConfirmedResponse> => anonymousAction('/auth/confirmation', input, 'CONFIRMED', signal),
    getPublicSettings: (signal?: AbortSignal) => send<PublicSettings>('/settings/public', signal),
    getStudioOverview: (signal?: AbortSignal) => send<StudioOverview>('/studio/overview', signal),
    getSession: (signal?: AbortSignal) => send<SessionResponse>('/auth/session', signal),
    getManagementAccess: (signal?: AbortSignal) => send<ManagementAccessResponse>('/management/access', signal),
    login: async (input: LoginInput, signal?: AbortSignal) => {
      const csrf = await send<CsrfResponse>('/auth/csrf', signal);
      return send<LoginResponse>('/auth/login', signal, { body: input, csrfToken: csrfToken(csrf) });
    },
    logout: async (signal?: AbortSignal) => {
      const session = await send<SessionResponse>('/auth/session', signal);
      await send<void>('/auth/logout', signal, { body: {}, csrfToken: csrfToken(session) });
    },
    logoutAll: async (signal?: AbortSignal) => {
      const session = await send<SessionResponse>('/auth/session', signal);
      await send<void>('/auth/logout-all', signal, { body: {}, csrfToken: csrfToken(session) });
    }
  };
}
