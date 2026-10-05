import {useEffect,useId,useMemo,useState} from 'react';
import type {Locale,OperationalAuditAction,OperationalAuditPage,OperationalAuditQuery,AuditValue} from '@conecta/contracts';
import type {useLocale} from '@conecta/i18n';
import {Button} from '@conecta/ui/components/button';
type Text=ReturnType<typeof useLocale>['t'];type Key=Parameters<Text>[0];
const actions:Record<OperationalAuditAction,Key>={
  'dependent.guardian_removed':'auditGuardianRemoved','dependent.guardian_invited':'auditGuardianInvited','dependent.guardian_accepted':'auditGuardianAccepted','dependent.created':'auditDependentCreated','dependent.profile_updated':'auditDependentUpdated','child_details.created':'auditChildDetailsCreated','child_details.updated':'auditChildDetailsUpdated','child_details.converted':'auditChildDetailsConverted',
  'family.responsibility_offered':'auditSuccessorOffered','family.responsibility_accepted':'auditSuccessorAccepted','family.responsibility_declined':'auditSuccessorDeclined',
  'account.created':'auditAccountCreated','account.profile_updated':'auditProfileUpdated','account.roles_changed':'auditRolesChanged',
  'account.deactivated':'auditAccountDeactivated','account.reactivated':'auditAccountReactivated','account.email_changed':'auditEmailChanged',
  'account.email_change_requested':'auditEmailRequested','account.confirmation_exempted':'auditConfirmationExempted','account.password_set':'auditPasswordSet',
  'settings.updated':'auditSettingsUpdated','development.demo_seeded':'auditDemoSeeded','family.created':'auditFamilyCreated','family.invitation_sent':'auditFamilyInvited','family.member_joined':'auditFamilyJoined',
  'family.member_left':'auditFamilyLeft','family.member_removed':'auditFamilyRemoved','family.closed':'auditFamilyClosed',other:'auditOther'};
const fields:Record<string,Key>={fullName:'fullName',phone:'phoneOptional',email:'email',preferredLocale:'preferredLanguage',roles:'accountRoles',status:'accountStatus',
  confirmationStatus:'confirmationStatus',exemptionSource:'auditExemption',photoId:'profilePhoto',displayName:'business',country:'auditCountry',currency:'currency',timezone:'timezone',
  defaultLocale:'preferredLanguage',supportedLocales:'auditLanguages',defaultCapacity:'auditCapacity',createdAccounts:'auditAccountCount',sessions:'auditSessionCount',bookings:'auditBookingCount',name:'auditFamilyName',memberCount:'auditMemberCount'};
function value(field:string,entry:AuditValue,t:Text):string{
  if(field==='photoId')return t(entry===null?'auditPhotoAbsent':'auditPhotoPresent');
  if(entry===null)return t('auditEmptyValue');
  if(field==='status'&&typeof entry==='string')return entry==='closed'?t('auditGroupClosed'):t(entry as Key);
  if(field==='confirmationStatus'&&typeof entry==='string')return t(entry==='pending'?'confirmationPendingStatus':entry as Key);
  if(field==='preferredLocale'||field==='defaultLocale')return entry==='es-MX'?'Español':'English';
  if(field==='exemptionSource')return t(entry==='management'?'auditManagedExemption':'auditManualBootstrap');
  if(field==='roles'&&Array.isArray(entry))return entry.map(role=>t(role as Key)).join(', ');
  return Array.isArray(entry)?entry.join(', '):String(entry);
}
export function OperationalAudit({api,t,locale,timezone,onAccessLost}:{api:{listOperationalAudit(query?:OperationalAuditQuery,signal?:AbortSignal):Promise<OperationalAuditPage>};
  t:Text;locale:Locale;timezone:string;onAccessLost:(code:'UNAUTHENTICATED'|'FORBIDDEN')=>void}){
  const id=useId(),[open,setOpen]=useState(false),[attempt,setAttempt]=useState(0),[cursors,setCursors]=useState<(string|undefined)[]>([undefined]);
  const [page,setPage]=useState<OperationalAuditPage|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(false);const cursor=cursors.at(-1);
  const format=useMemo(()=>new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short',timeZone:timezone}),[locale,timezone]);
  useEffect(()=>{
    if(!open)return;const controller=new AbortController();setLoading(true);setError(false);setPage(null);
    api.listOperationalAudit({limit:25,cursor},controller.signal).then(result=>{if(!controller.signal.aborted)setPage(result);})
      .catch(value=>{if(!controller.signal.aborted){if(value instanceof Error&&'code' in value&&(value.code==='UNAUTHENTICATED'||value.code==='FORBIDDEN'))onAccessLost(value.code);else setError(true);}})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();
  },[api,open,cursor,attempt,onAccessLost]);
  return <section className="mt-6 space-y-4 rounded-xl border bg-white p-4 sm:p-6" aria-labelledby={id}>
    <h2 id={id} className="text-xl font-semibold">{t('auditTitle')}</h2><p className="text-sm text-muted-foreground">{t('auditIntro')}</p>
    {!open?<Button variant="outline" className="min-h-11" onClick={()=>setOpen(true)}>{t('viewAudit')}</Button>:<>
      <Button variant="outline" className="min-h-11" disabled={loading} onClick={()=>{setCursors([undefined]);setAttempt(value=>value+1);}}>{t('refreshAudit')}</Button>
      {loading&&<p role="status">{t('auditLoading')}</p>}{error&&<div className="space-y-3"><p role="alert" className="text-sm text-destructive">{t('auditUnavailable')}</p><Button onClick={()=>setAttempt(value=>value+1)}>{t('retry')}</Button></div>}
      {page&&<>{page.events.length===0&&<p>{t('auditEmpty')}</p>}<ol className="space-y-3">{page.events.map(event=><li key={event.id} className="space-y-2 break-words rounded-lg border p-4">
        <h3 className="font-semibold">{t(actions[event.action])}</h3><time dateTime={event.occurredAt} className="text-sm text-muted-foreground">{format.format(new Date(event.occurredAt))}</time>
        <dl className="text-sm"><dt className="font-medium">{t('auditActor')}</dt><dd>{event.actorName??t(event.actorType==='system'?'auditSystem':'auditUnknown')}</dd>
          <dt className="mt-2 font-medium">{t('auditTarget')}</dt><dd>{event.targetName??t(event.targetType==='business_settings'?'auditSettingsTarget':event.targetType==='dataset'?'auditDatasetTarget':'auditUnknown')}</dd></dl>
        {event.correctionOf&&<p className="text-sm">{t('auditCorrection')}</p>}
        <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">{t('auditChanges')}</summary><div className="grid gap-4 sm:grid-cols-2">{(['before','after'] as const).map(side=><div key={side}><h4 className="mb-2 text-sm font-semibold">{t(side==='before'?'auditBefore':'auditAfter')}</h4>
          <dl className="space-y-2 text-sm">{Object.entries(event.changes[side]??{}).filter(([key])=>key in fields).map(([key,entry])=><div key={key}><dt className="font-medium">{t(fields[key])}</dt><dd>{value(key,entry,t)}</dd></div>)}</dl></div>)}</div></details>
      </li>)}</ol><nav aria-label={t('auditPages')} className="flex flex-wrap items-center gap-3"><Button variant="outline" className="min-h-11" disabled={cursors.length===1||loading} onClick={()=>setCursors(value=>value.slice(0,-1))}>{t('previousPage')}</Button><span>{t('pageNumber')} {cursors.length}</span><Button variant="outline" className="min-h-11" disabled={!page.nextCursor||loading} onClick={()=>{if(page.nextCursor)setCursors(value=>[...value,page.nextCursor!]);}}>{t('nextPage')}</Button></nav></>}
    </>}
  </section>;
}
