import {
  CategoryIdSchema,
  CategoryTrendCalc,
  TrendPoint,
  TrendStatus,
  UploadListItem,
} from '@proyecto/shared-types';

export interface TrendOptions {
  /** Mínimo de uploads calificados por categoría para calcular tendencia (>= 2). */
  minUploads: number;
  /** Pendiente (puntos por upload) por encima de la cual la categoría mejora. */
  slopeImproving: number;
  /** Pendiente por debajo de la cual la categoría empeora (normalmente negativa). */
  slopeWorsening: number;
}

/** Calificado: ready con confianza HIGH/MEDIUM (LOW en ready no debería existir: se descarta). */
function isQualified(item: UploadListItem): boolean {
  return item.status === 'ready' && (item.confidence === 'HIGH' || item.confidence === 'MEDIUM');
}

function pointFor(
  item: UploadListItem,
  categoryId: CategoryTrendCalc['categoryId']
): TrendPoint | undefined {
  if (!isQualified(item)) return undefined;
  const found = item.scores.find((s) => s.categoryId === categoryId);
  if (found === undefined) return undefined;
  return { uploadId: item.uploadId, score: found.score, timestamp: item.timestamp };
}

/**
 * Regresión lineal por mínimos cuadrados con x = 0..n-1.
 * slope = (n·Σxy − Σx·Σy) / (n·Σx² − (Σx)²); numerador y denominador enteros
 * hasta la división final. Devuelve ambos para clasificar sin error de redondeo.
 */
function regression(scores: number[]): { num: number; den: number } {
  const n = scores.length;
  let sx = 0;
  let sy = 0;
  let sxy = 0;
  let sxx = 0;
  scores.forEach((y, x) => {
    sx += x;
    sy += y;
    sxy += x * y;
    sxx += x * x;
  });
  return { num: n * sxy - sx * sy, den: n * sxx - sx * sx };
}

/**
 * Calcula la tendencia de las 5 categorías (siempre en orden CAT-1..CAT-5).
 * `items` llega como lo devuelve ingestion: más reciente primero. No se reordena
 * por timestamp: se invierte el listado (los empates de milisegundos mandan el orden).
 */
export function calculateTrends(
  items: UploadListItem[],
  options: TrendOptions
): CategoryTrendCalc[] {
  const chronological = [...items].reverse();

  return CategoryIdSchema.options.map((categoryId): CategoryTrendCalc => {
    const series: TrendPoint[] = [];
    for (const item of chronological) {
      const point = pointFor(item, categoryId);
      if (point !== undefined) series.push(point);
    }

    const qualifiedCount = series.length;
    const uploadsNeeded = Math.max(0, options.minUploads - qualifiedCount);
    if (uploadsNeeded > 0) {
      return { categoryId, status: TrendStatus.insufficient, qualifiedCount, uploadsNeeded };
    }

    const { num, den } = regression(series.map((p) => p.score));
    // den > 0 con n >= 2: se compara sin dividir para que los bordes sean exactos.
    let status: CategoryTrendCalc['status'] = TrendStatus.stagnating;
    if (num > options.slopeImproving * den) status = TrendStatus.improving;
    else if (num < options.slopeWorsening * den) status = TrendStatus.worsening;

    return { categoryId, status, qualifiedCount, uploadsNeeded, slope: num / den, series };
  });
}
