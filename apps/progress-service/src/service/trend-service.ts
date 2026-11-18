import { CategoryTrendCalc } from '@proyecto/shared-types';
import { FetchFn, UploadListResult, fetchUploadList } from './ingestion-client';
import { TrendOptions, calculateTrends } from './trend-calculator';

export type TrendsResult =
  { ok: true; trends: CategoryTrendCalc[] } | Extract<UploadListResult, { ok: false }>;

export interface GetTrendsParams {
  /** Valor de la cabecera Authorization del usuario, reenviado tal cual. */
  authorization: string;
  fetchFn: FetchFn;
  baseUrl: string;
  timeoutMs: number;
  options: TrendOptions;
}

/**
 * Lee el historial completo de ingestion y calcula la tendencia de las 5 categorías.
 * Calcula al leer, sin persistir. Ante cualquier fallo devuelve el resultado del
 * cliente de ingestion tal cual: nunca tendencias parciales. No escribe en consola.
 */
export async function getTrends(params: GetTrendsParams): Promise<TrendsResult> {
  const list = await fetchUploadList({
    authorization: params.authorization,
    fetchFn: params.fetchFn,
    baseUrl: params.baseUrl,
    timeoutMs: params.timeoutMs,
  });
  if (!list.ok) return list;
  return { ok: true, trends: calculateTrends(list.items, params.options) };
}
