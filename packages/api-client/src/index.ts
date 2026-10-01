import type { ApiErrorCode, PublicSettings, StudioOverview } from '@conecta/contracts';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  constructor(code: ApiErrorCode) { super(code); this.name = 'ApiError'; this.code = code; }
}

export function createApiClient(baseUrl = '/api/v1', request: typeof fetch = fetch) {
  async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
    let response: Response;
    try { response = await request(`${baseUrl.replace(/\/$/, '')}${path}`, { signal }); }
    catch (error) { if (signal?.aborted) throw error; throw new ApiError('UNAVAILABLE'); }
    if (!response.ok) {
      const code = response.status === 404 ? 'NOT_FOUND' : response.status >= 500 ? 'UNAVAILABLE' : 'INVALID_REQUEST';
      throw new ApiError(code);
    }
    try { return await response.json() as T; }
    catch { throw new ApiError('INTERNAL_ERROR'); }
  }
  return {
    getPublicSettings: (signal?: AbortSignal) => get<PublicSettings>('/settings/public', signal),
    getStudioOverview: (signal?: AbortSignal) => get<StudioOverview>('/studio/overview', signal)
  };
}
