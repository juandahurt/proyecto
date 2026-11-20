import { DeleteHistoryRequestSchema } from '@proyecto/shared-types';
import type { ApiClient, ApiErrorKind, ApiResult } from './client';

export interface Outcome<T> {
  ok: boolean;
  status: number;
  kind: ApiErrorKind;
  data: T | null;
}

/** `204` no tiene cuerpo: no hay nada que validar con Zod en la respuesta. */
function toVoidOutcome(res: ApiResult): Outcome<null> {
  if (!res.ok) return { ok: false, status: res.status, kind: res.kind, data: null };
  return { ok: true, status: res.status, kind: 'none', data: null };
}

/**
 * `DELETE /api/history`: borra el historial (subidas + críticas) del usuario autenticado.
 * El body se valida contra `DeleteHistoryRequestSchema` (shared-types) al construirlo, no al
 * leer la respuesta: un `204` no trae cuerpo.
 */
export async function deleteHistory(client: ApiClient): Promise<Outcome<null>> {
  const body = DeleteHistoryRequestSchema.parse({ confirmation: 'DELETE' });
  const res = await client.request('DELETE', '/api/history', { body });
  return toVoidOutcome(res);
}
