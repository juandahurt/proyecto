import { UploadListItem, UploadListSchema } from '@proyecto/shared-types';

export type FetchFn = typeof fetch;

export type UploadListResult =
  | { ok: true; items: UploadListItem[] }
  | { ok: false; kind: 'unauthenticated' | 'upstream' | 'bad-response' | 'timeout' };

export interface FetchUploadListParams {
  /** Valor de la cabecera Authorization del usuario, reenviado tal cual. */
  authorization: string;
  fetchFn: FetchFn;
  baseUrl: string;
  timeoutMs: number;
}

function isTimeout(err: unknown): boolean {
  // Duck-typing: DOMException puede venir de otro realm (p. ej. jest) y fallar instanceof Error.
  const name =
    typeof err === 'object' && err !== null ? (err as { name?: unknown }).name : undefined;
  return name === 'TimeoutError' || name === 'AbortError';
}

/**
 * GET {baseUrl}/api/uploads reenviando solo la cabecera Authorization.
 * Sin query, sin cuerpo, sin otras cabeceras del cliente. Nunca lanza: todo
 * fallo se devuelve como resultado discriminado.
 */
export async function fetchUploadList(params: FetchUploadListParams): Promise<UploadListResult> {
  const { authorization, fetchFn, baseUrl, timeoutMs } = params;
  const url = `${baseUrl.replace(/\/+$/, '')}/api/uploads`;

  let response: Response;
  try {
    response = await fetchFn(url, {
      method: 'GET',
      headers: { Authorization: authorization },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err: unknown) {
    return { ok: false, kind: isTimeout(err) ? 'timeout' : 'upstream' };
  }

  if (response.status === 401) return { ok: false, kind: 'unauthenticated' };
  if (response.status !== 200) return { ok: false, kind: 'upstream' };

  let json: unknown;
  try {
    json = await response.json();
  } catch (err: unknown) {
    // El cuerpo tambien esta sujeto al timeout: si se corta a medias es un timeout.
    return { ok: false, kind: isTimeout(err) ? 'timeout' : 'bad-response' };
  }

  const parsed = UploadListSchema.safeParse(json);
  if (!parsed.success) return { ok: false, kind: 'bad-response' };
  return { ok: true, items: parsed.data.data.items };
}
