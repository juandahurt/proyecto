import { LimitsResponseSchema, TrendTier } from '@proyecto/shared-types';
import { FetchFn } from './ingestion-client';

export type LimitsResult =
  | { ok: true; tier: TrendTier }
  | {
      ok: false;
      kind: 'unauthenticated' | 'upstream' | 'bad-response' | 'timeout';
      /** Status HTTP de identity, solo si hubo respuesta. */
      status?: number;
    };

export interface FetchLimitsParams {
  /** Valor de la cabecera Authorization del usuario, reenviado tal cual. */
  authorization: string;
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
 * Sin query, sin cuerpo, sin otras cabeceras del cliente. Nunca lanza y nunca
 * asume un tier: todo fallo se devuelve como resultado discriminado.
 */
export async function fetchLimits(params: FetchLimitsParams): Promise<LimitsResult> {
  const { authorization, fetchFn, baseUrl, timeoutMs } = params;
  const url = `${baseUrl.replace(/\/+$/, '')}/api/users/me/limits`;

  let response: Response;
  try {
    response = await fetchFn(url, {
      method: 'GET',
      // Un 3xx no se sigue: la unica salida de red es hacia identity e ingestion (AC-4.2).
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

  const parsed = LimitsResponseSchema.safeParse(json);
  if (!parsed.success) return { ok: false, kind: 'bad-response' };
  return { ok: true, tier: parsed.data.data.tier };
}
