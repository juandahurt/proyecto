import { z } from 'zod';
import { CategoryIdSchema, CategoryNameSchema } from './anthropic';
import { LimitsResponseSchema } from './limits';
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

// =============================================================================
// C3 — Respuesta de GET /api/trends (u7-T01), con puerta de tier
// =============================================================================

/** Tier del usuario: el mismo enum que devuelve identity en /me/limits. */
export const TrendTierSchema = LimitsResponseSchema.shape.data.shape.tier;

export type TrendTier = z.infer<typeof TrendTierSchema>;

/** Dirección de una tendencia real (sin `insufficient_data`). */
export const TrendDirectionOnlySchema = TrendDirectionSchema.exclude(['insufficient_data']);

/** Estado de una categoría en la respuesta: el del cálculo más `locked` (puerta de tier). */
export const CategoryTrendStatusSchema = z.enum(['locked', ...TrendDirectionSchema.options]);

export type CategoryTrendStatus = z.infer<typeof CategoryTrendStatusSchema>;

export const CategoryTrendSchema = z
  .object({
    categoryId: CategoryIdSchema,
    categoryName: CategoryNameSchema,
    status: CategoryTrendStatusSchema,
    /** Uploads que faltan para tener tendencia. Solo con `insufficient_data`. */
    uploadsNeeded: z.number().int().min(0).optional(),
    /** Solo con tendencia real (`improving|stagnating|worsening`). */
    trend: z
      .object({
        direction: TrendDirectionOnlySchema,
        /** Cronológico: más antiguo primero. */
        scoreHistory: z.array(TrendPointSchema),
      })
      .optional(),
  })
  .refine(
    (v) => {
      const hasDirection =
        v.status === 'improving' || v.status === 'stagnating' || v.status === 'worsening';
      if (hasDirection) {
        if (v.trend === undefined || v.trend.direction !== v.status) return false;
      } else if (v.trend !== undefined) {
        return false;
      }
      return v.uploadsNeeded === undefined || v.status === 'insufficient_data';
    },
    {
      message:
        'trend solo con improving|stagnating|worsening (y direction === status); uploadsNeeded solo con insufficient_data',
    }
  );

export type CategoryTrend = z.infer<typeof CategoryTrendSchema>;

export const TrendResponseSchema = z.object({
  data: z.object({
    tier: TrendTierSchema,
    categories: z.array(CategoryTrendSchema),
  }),
  error: z.null(),
  status: z.literal(200),
});

export type TrendResponse = z.infer<typeof TrendResponseSchema>;

/** Mapa categoryId -> categoryName (C10), tipado desde los schemas. */
export const CATEGORY_NAME_BY_ID: Record<
  z.infer<typeof CategoryIdSchema>,
  z.infer<typeof CategoryNameSchema>
> = {
  'CAT-1': 'Composition',
  'CAT-2': 'Proportions',
  'CAT-3': 'Line Quality',
  'CAT-4': 'Values (Shading)',
  'CAT-5': 'Perspective',
};
