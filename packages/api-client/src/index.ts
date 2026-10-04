import type { ApiErrorCode, CsrfResponse, LoginInput, LoginResponse, SessionResponse, PublicSettings, StudioOverview, ManagementAccessResponse, RegistrationInput, ActionAcceptedResponse, EmailConfirmedResponse, PasswordResetInput, PasswordResetResponse, CustomerInvitationInput, PasswordSetupResponse } from '@conecta/contracts';

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
        : response.status === 403 ? 'FORBIDDEN' : response.status === 429 ? 'THROTTLED'
        : response.status === 404 ? 'NOT_FOUND' : response.status === 409 ? 'CONFLICT' : response.status >= 500 ? 'UNAVAILABLE'
        : response.status === 400 && ['/auth/confirmation', '/auth/recovery/reset', '/auth/setup'].includes(path) && body?.code === 'INVALID_ACTION' ? 'INVALID_ACTION' : 'INVALID_REQUEST';
      const retry = response.headers.get('Retry-After');
      const seconds = retry && /^[1-9][0-9]{0,6}$/.test(retry) ? Number(retry) : undefined;
      throw new ApiError(code, code === 'THROTTLED' ? seconds : undefined);
    }
    if (response.status === 204) return undefined as T;
    try { return await response.json() as T; }
    catch { throw new ApiError('INTERNAL_ERROR'); }
  }
  async function anonymousAction<T extends 'ACCEPTED' | 'CONFIRMED' | 'PASSWORD_RESET' | 'PASSWORD_SET'>(path: string, body: unknown, code: T, signal?: AbortSignal): Promise<{ code: T }> {
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
  return {
    inviteCustomer: (input: CustomerInvitationInput, signal?: AbortSignal) => invitation('/accounts/invitations', input, signal),
    resendInvitation: (input: { email: string }, signal?: AbortSignal) => invitation('/accounts/invitations/resend', input, signal),
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
