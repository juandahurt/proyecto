import {
  CATEGORY_NAME_BY_ID,
  CategoryTrend,
  CategoryTrendCalc,
  TrendResponse,
  TrendStatus,
  TrendTier,
} from '@proyecto/shared-types';

function toCategoryTrend(calc: CategoryTrendCalc, tier: TrendTier): CategoryTrend {
  const base = { categoryId: calc.categoryId, categoryName: CATEGORY_NAME_BY_ID[calc.categoryId] };

  // Sin tendencia no hay nada que bloquear: se queda como esta.
  if (calc.status === TrendStatus.insufficient) {
    return { ...base, status: calc.status, uploadsNeeded: calc.uploadsNeeded };
  }
  // Puerta de datos (AC-7.1): con free ninguna direccion ni historial sale del servicio.
  if (tier === 'free') {
    return { ...base, status: 'locked' };
  }
  return {
    ...base,
    status: calc.status,
    // `series` ya es cronologica (mas antiguo primero); slope no se expone.
    trend: { direction: calc.status, scoreHistory: calc.series ?? [] },
  };
}

/**
 * Arma la respuesta C3 a partir del calculo (u6) aplicando la puerta de tier.
 * Funcion pura: no lee entorno, no escribe en consola.
 */
export function buildTrendResponse(tier: TrendTier, calcs: CategoryTrendCalc[]): TrendResponse {
  return {
    data: { tier, categories: calcs.map((c) => toCategoryTrend(c, tier)) },
    error: null,
    status: 200,
  };
}
