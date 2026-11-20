export type FetchFn = typeof fetch;

export type IngestionDeleteResult = { ok: true } | { ok: false };

export interface DeleteUserDataParams {
  userId: string;
  fetchFn: FetchFn;
  baseUrl: string;
  timeoutMs: number;
}

/**
 * DELETE {baseUrl}/api/internal/users/{userId}/data — endpoint interno de
 * ingestion-service (network-trusted, sin JWT: no se reenvía Authorization).
 * Nunca lanza: todo fallo (red, timeout, status != 204) se devuelve como
 * resultado discriminado { ok: false }. Mismo patrón que
 * progress-service/src/service/ingestion-client.ts.
 */
export async function deleteUserData(params: DeleteUserDataParams): Promise<IngestionDeleteResult> {
  const { userId, fetchFn, baseUrl, timeoutMs } = params;
  const url = `${baseUrl.replace(/\/+$/, '')}/api/internal/users/${userId}/data`;

  let response: Response;
  try {
    response = await fetchFn(url, {
      method: 'DELETE',
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (_err: unknown) {
    return { ok: false };
  }

  if (response.status !== 204) return { ok: false };
  return { ok: true };
}
