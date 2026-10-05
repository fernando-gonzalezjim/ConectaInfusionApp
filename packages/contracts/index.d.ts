export interface YogaClass {
  id: string;
  name: string;
  instructor: string;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  booked: number;
}
export interface CafeProduct {
  id: string;
  name: string;
  category: "coffee" | "tea" | "food" | "retail";
  priceMinor: number;
  currency: string;
}
export interface StudioOverview {
  mode: "live";
  classes: YogaClass[];
  products: CafeProduct[];
}

export type Locale = 'es-MX' | 'en';
export type BusinessUnitCode = 'studio' | 'cafe';
export interface PublicSettings {
  displayName: string;
  currency: 'MXN';
  timezone: string;
  defaultLocale: Locale;
  supportedLocales: Locale[];
  units: { code: BusinessUnitCode; labels: Record<Locale, string> }[];
}
export type IdentityRole = 'administrator' | 'manager' | 'reception' | 'cafe_staff' | 'instructor' | 'customer';
export interface PublicAccount {
  id: string;
  personId: string;
  email: string;
  fullName: string;
  preferredLocale: Locale;
  roles: IdentityRole[];
}
export interface LoginInput { email: string; password: string; rememberMe?: boolean }
export interface RegistrationInput { fullName: string; email: string; password: string; phone?: string | null; preferredLocale?: Locale }
export interface ActionAcceptedResponse { code: 'ACCEPTED' }
export interface EmailConfirmedResponse { code: 'CONFIRMED' }
export interface EmailChangeInput { email: string }
export interface EmailChangedResponse { code: 'EMAIL_CHANGED' }
export interface PasswordResetInput { token: string; password: string }
export interface PasswordResetResponse { code: 'PASSWORD_RESET' }
export interface CustomerInvitationInput { fullName: string; email: string; phone?: string | null; preferredLocale?: Locale; waiveConfirmation?: boolean; reason?: string }
export interface PasswordSetupResponse { code: 'PASSWORD_SET' }
export interface AccountProfileInput { fullName?: string; phone?: string | null; preferredLocale?: Locale }
export interface AccountProfile extends PublicAccount {
  phone: string | null; photoId: string | null;
  status: 'pending' | 'active' | 'inactive'; profileStatus: 'active' | 'inactive';
  confirmationStatus: 'pending' | 'verified' | 'exempt';
}
export interface AccountListResponse { accounts: AccountProfile[]; nextCursor: string | null }
export interface AccountListQuery { limit?: number; cursor?: string; role?: IdentityRole; status?: AccountProfile['status'] }
export interface RoleChangeInput { roles: IdentityRole[] }
export interface RoleChangeResponse { accountId: string; roles: IdentityRole[]; staffAttendanceEligible: boolean }
export interface CsrfResponse { csrfToken: string }
export interface LoginResponse extends CsrfResponse { account: PublicAccount; expiresAt: string }
export interface SessionResponse extends LoginResponse { authenticatedAt: string }
export interface ManagementAccessResponse {
  account: PublicAccount;
  capabilities: { administerIdentity: true };
}
export type ApiErrorCode = 'UNAVAILABLE' | 'INVALID_REQUEST' | 'NOT_FOUND' | 'INTERNAL_ERROR'
  | 'INVALID_CREDENTIALS' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'THROTTLED' | 'IDENTITY_DISABLED' | 'INVALID_ACTION' | 'CONFLICT' | 'RECENT_AUTH_REQUIRED';
export interface PhotoUploadInput { data: string; }
export type OperationalAuditAction = 'account.created'|'account.profile_updated'|'account.roles_changed'|'account.deactivated'|'account.reactivated'
  |'account.email_changed'|'account.email_change_requested'|'account.confirmation_exempted'|'account.password_set'|'settings.updated'|'development.demo_seeded'
  |'family.created'|'family.invitation_sent'|'family.member_joined'|'family.member_left'|'family.member_removed'|'family.closed'|'family.responsibility_offered'|'family.responsibility_accepted'|'family.responsibility_declined'
  |'dependent.created'|'dependent.profile_updated'|'child_details.created'|'child_details.updated'|'child_details.converted'|'dependent.guardian_invited'|'dependent.guardian_accepted'|'dependent.guardian_removed'|'other';
export type AuditValue = string|number|boolean|null|string[];
export interface OperationalAuditEvent {
  id:string; occurredAt:string; actorType:'staff'|'customer'|'system'; actorId:string|null; actorName:string|null;
  action:OperationalAuditAction; targetType:'account'|'family'|'dependent'|'child_details'|'business_settings'|'dataset'|'other'; targetId:string|null; targetName:string|null;
  businessUnit:BusinessUnitCode|null; correctionOf:string|null;
  changes:{before:Record<string,AuditValue>|null;after:Record<string,AuditValue>|null};
}
export interface OperationalAuditQuery { limit?:number; cursor?:string }
export interface OperationalAuditPage { events:OperationalAuditEvent[]; nextCursor:string|null }
export interface FamilyView {
  id:string; name:string; createdByPersonId:string; responsibleMembershipId:string|null;
  status:'active'|'closed'; version:number;
}
export interface FamilyCreateInput {name:string}
export interface FamilyInvitationInput {email:string}
export interface FamilyInvitationActionInput {token:string}
export interface FamilyInvitationPreview {family:Pick<FamilyView,'id'|'name'>;expiresAt:string}
export interface FamilyResponsibilityState {canNominate:boolean}
// Internal domain composition contracts; no public lifecycle routes yet.
export type FamilyLifecycleRequest={familyId:string;expectedVersion:number}&(
  {operation:'close'}|
  {operation:'leave';membershipId:string;creditChoice:'keep'|'donate'}|
  {operation:'remove';membershipId:string;creditChoice?:'keep'|'donate';donationConsentReference?:string}
);
export type FamilyCreditPolicy='return-own-eligible'|'leave-own-eligible'|'return-all-to-original-purchasers';
export interface FamilyLifecyclePreview {
  familyId:string;version:number;operation:'leave'|'remove'|'close';membershipId?:string;personId?:string;
  closesFamily:boolean;policy:FamilyCreditPolicy;revision:string;
}
export type FamilyLifecycleExecutionRequest=FamilyLifecycleRequest&{expectedFinancialRevision:string};
export interface DependentProfileView {id:string;fullName:string;ageText:string;preferredLocale:Locale;version:number;guardians:{accountId:string;fullName:string}[]}
export interface GuardianInviteTarget {id:string;fullName:string}
export interface GuardianInvitationPreview {dependent:GuardianInviteTarget;expiresAt:string}
export interface GuardianInvitationAccepted {dependentId:string}
export interface GuardianRemovalTarget {id:string;accountId:string;fullName:string;canRemove:boolean}
export interface GuardianRemovedResponse {dependentId:string;guardianRelationshipId:string}
export interface SavedChildView {id:string;childName:string;ageText:string;dependentPersonId:string|null;version:number}
export interface DependentProfileInput {fullName:string;ageText:string;preferredLocale?:Locale}
export interface SavedChildInput {childName:string;ageText:string}
export interface IdentityPage<T> {items:T[];nextCursor:string|null}
