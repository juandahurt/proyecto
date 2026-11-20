export type FetchFn = typeof fetch;

export type LimitsResult =
  | { ok: true; uploadsRemaining: number | null }
  | {
      ok: false;
      kind: 'unauthenticated' | 'upstream' | 'bad-response' | 'timeout';
      /** Status HTTP de identity, solo si hubo respuesta. */
      status?: number;
    };

export interface FetchLimitsParams {
  /** Valor de la cabecera Authorization del request original, reenviado tal cual. */
  authorization: string;
  fetchFn: FetchFn;
  baseUrl: string;
  timeoutMs: number;
}

export type IncrementCounterResult = { ok: true } | { ok: false };

export interface IncrementCounterParams {
  userId: string;
  fetchFn: FetchFn;
  baseUrl: string;
  timeoutMs: number;
}

function isTimeout(err: unknown): boolean {
  // Solo TimeoutError (AbortSignal.timeout). Duck-typing: DOMException puede venir de otro realm.
  const name =
    typeof err === 'object' && err !== null ? (err as { name?: unknown }).name : undefined;
  return name === 'TimeoutError';
}

/**
 * GET {baseUrl}/api/users/me/limits reenviando solo la cabecera Authorization.
 * Sin query, sin cuerpo, sin otras cabeceras del cliente. Nunca lanza: todo
 * fallo se devuelve como resultado discriminado. Mismo patrón que
 * progress-service/src/service/identity-client.ts.
 */
export async function fetchLimits(params: FetchLimitsParams): Promise<LimitsResult> {
  const { authorization, fetchFn, baseUrl, timeoutMs } = params;
  const url = `${baseUrl.replace(/\/+$/, '')}/api/users/me/limits`;

  let response: Response;
  try {
    response = await fetchFn(url, {
      method: 'GET',
      // Un 3xx no se sigue: la única salida de red es hacia identity (AC-4.2).
      redirect: 'error',
      headers: { Authorization: authorization },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err: unknown) {
    return { ok: false, kind: isTimeout(err) ? 'timeout' : 'upstream' };
  }

  if (response.status === 401) return { ok: false, kind: 'unauthenticated' };
  if (response.status !== 200) return { ok: false, kind: 'upstream', status: response.status };

  let json: unknown;
  try {
    json = await response.json();
  } catch (err: unknown) {
    return { ok: false, kind: isTimeout(err) ? 'timeout' : 'bad-response' };
  }

  const data = json as { data?: { uploadsRemaining?: unknown } } | null;
  const remaining = data?.data?.uploadsRemaining;
  if (remaining !== null && typeof remaining !== 'number') {
    return { ok: false, kind: 'bad-response' };
  }
  return { ok: true, uploadsRemaining: remaining ?? null };
}

/**
 * POST {baseUrl}/api/internal/users/{userId}/increment-counter — endpoint
 * interno de identity-service (network-trusted, sin JWT: no se reenvía
 * Authorization). Nunca lanza: todo fallo (red, timeout, status != 200) se
 * devuelve como resultado discriminado { ok: false }. Mismo patrón que
 * trust-service/src/service/identity-client.ts (resetCounter), salvo que
 * increment-counter responde 200, no 204.
 */
export async function incrementCounter(
  params: IncrementCounterParams
): Promise<IncrementCounterResult> {
  const { userId, fetchFn, baseUrl, timeoutMs } = params;
  const url = `${baseUrl.replace(/\/+$/, '')}/api/internal/users/${userId}/increment-counter`;

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

  if (response.status !== 200) return { ok: false };
  return { ok: true };
}
