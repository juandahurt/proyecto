import { z } from 'zod';
import { CategoryIdSchema } from './anthropic';
import { CategoryCritiqueSchema, UploadListItemSchema } from './uploads';

// =============================================================================
// C3 — Resultado de tendencia por categoría (u6-T01)
// Resultado del motor de cálculo. `locked` NO va aquí: es de u7.
// =============================================================================

export const TrendDirectionSchema = z.enum([
  'insufficient_data',
  'improving',
  'stagnating',
  'worsening',
]);

export type TrendDirection = z.infer<typeof TrendDirectionSchema>;

/** Acceso por clave a los valores del enum, para no repetir los literales fuera de este módulo. */
export const TrendStatus = {
  insufficient: TrendDirectionSchema.enum.insufficient_data,
  improving: TrendDirectionSchema.enum.improving,
  stagnating: TrendDirectionSchema.enum.stagnating,
  worsening: TrendDirectionSchema.enum.worsening,
} as const;

/** Punto de la serie: un upload calificado de la categoría. */
export const TrendPointSchema = z.object({
  uploadId: UploadListItemSchema.shape.uploadId,
  score: CategoryCritiqueSchema.shape.score,
  timestamp: UploadListItemSchema.shape.timestamp,
});

export type TrendPoint = z.infer<typeof TrendPointSchema>;

export const CategoryTrendCalcSchema = z
  .object({
    categoryId: CategoryIdSchema,
    status: TrendDirectionSchema,
    /** Uploads calificados (ready con confianza HIGH/MEDIUM y score de la categoría). */
    qualifiedCount: z.number().int().min(0),
    /** Uploads que faltan para llegar al mínimo; 0 cuando hay suficientes. */
    uploadsNeeded: z.number().int().min(0),
    /** Pendiente en puntos por upload. Solo con tendencia. */
    slope: z.number().optional(),
    /** Serie en orden cronológico (más antiguo primero). Solo con tendencia. */
    series: z.array(TrendPointSchema).optional(),
  })
  .refine(
    (v) =>
      v.status === 'insufficient_data'
        ? v.slope === undefined && v.series === undefined
        : v.slope !== undefined && v.series !== undefined,
    { message: 'slope y series solo están presentes cuando hay tendencia' }
  );

export type CategoryTrendCalc = z.infer<typeof CategoryTrendCalcSchema>;
