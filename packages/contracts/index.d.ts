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
  | 'INVALID_CREDENTIALS' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'THROTTLED' | 'IDENTITY_DISABLED' | 'INVALID_ACTION' | 'CONFLICT';
