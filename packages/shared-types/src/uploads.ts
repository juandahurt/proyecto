import { z } from 'zod';
import { CategoryIdSchema, CategoryNameSchema } from './anthropic';

// =============================================================================
// C1 — Upload Result (u2-T01)
// Schema autoritativo para la respuesta 202 del endpoint POST /api/uploads.
// Sustituye el UploadIdResponseSchema del walking skeleton (u1-T01).
// Los tipos TypeScript se derivan de este schema via z.infer<>.
// =============================================================================

/**
 * Schema Zod para un objeto de crítica por categoría dentro de UploadResult.
 * Campos: categoryId (CAT-1..5 enum), categoryName (enum), score (0-100 int),
 * feedback (string ≥1 char).
 */
export const CategoryCritiqueSchema = z.object({
  /** Identificador de la categoría: CAT-1 .. CAT-5 */
  categoryId: CategoryIdSchema,

  /** Nombre de la categoría según el enum C10 */
  categoryName: CategoryNameSchema,

  /** Puntuación entera de 0 a 100 (inclusive) */
  score: z.number().int().min(0).max(100),

  /** Texto de feedback. Debe tener al menos 1 caracter. */
  feedback: z.string().min(1),
});

/** Tipo TypeScript derivado. Nunca definir manualmente. */
export type CategoryCritique = z.infer<typeof CategoryCritiqueSchema>;

/**
 * Schema Zod para el body de la respuesta 202 del endpoint POST /api/uploads.
 * Incluye uploadId, status, confidence, categories (opcionales) y fallbackReason (opcional).
 * La envoltura uniforme es { data: UploadResultData, error: null, status: 202 }.
 *
 * Reemplaza UploadIdResponseSchema (u1-T01) con el contrato completo C10.
 */
export const UploadResultSchema = z.object({
  data: z.object({
    /** UUID del upload generado en el servidor. Nunca viene del cliente. */
    uploadId: z.string().uuid(),

    /** Estado del upload: "ready" cuando confidence es HIGH/MEDIUM; "low_confidence" en fallback. */
    status: z.enum(['ready', 'low_confidence']),

    /** Nivel de confianza de la crítica de Claude */
    confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),

    /**
     * Categorías de crítica. Presentes cuando confidence es HIGH o MEDIUM.
     * Opcional: puede estar ausente en el path de low_confidence (u3).
     */
    categories: z.array(CategoryCritiqueSchema).optional(),

    /**
     * Razón del fallback. Solo presente cuando status es "low_confidence" (u3).
     */
    fallbackReason: z.enum(['low_confidence_flag', 'invalid_schema', 'timeout']).optional(),
  }),
  error: z.null(),
  status: z.literal(202),
});

/** Tipo TypeScript derivado. Nunca definir manualmente. */
export type UploadResult = z.infer<typeof UploadResultSchema>;
