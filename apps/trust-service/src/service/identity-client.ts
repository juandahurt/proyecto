import { FetchFn } from './ingestion-client';

export type IdentityResetResult = { ok: true } | { ok: false };

export interface ResetCounterParams {
  userId: string;
  fetchFn: FetchFn;
  baseUrl: string;
  timeoutMs: number;
}

/**
 * POST {baseUrl}/api/internal/users/{userId}/reset-counter — endpoint interno
 * de identity-service (network-trusted, sin JWT: no se reenvía Authorization).
 * Nunca lanza: todo fallo (red, timeout, status != 204) se devuelve como
 * resultado discriminado { ok: false }. Mismo patrón que
 * progress-service/src/service/identity-client.ts.
 */
export async function resetCounter(params: ResetCounterParams): Promise<IdentityResetResult> {
  const { userId, fetchFn, baseUrl, timeoutMs } = params;
  const url = `${baseUrl.replace(/\/+$/, '')}/api/internal/users/${userId}/reset-counter`;

  let response: Response;
  try {
    response = await fetchFn(url, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (_err: unknown) {
    return { ok: false };
  }

  if (response.status !== 204) return { ok: false };
  return { ok: true };
}
