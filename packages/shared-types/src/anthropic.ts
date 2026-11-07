import { z } from 'zod';

/**
 * Schema Zod para la respuesta del cliente de Anthropic (critique).
 * Es la fuente autoritativa del contrato entre el servicio de IA y sus consumidores.
 * Los tipos TypeScript se derivan de este schema via z.infer<>.
 */
export const CritiqueResponseSchema = z.object({
  /** Resumen general de la crítica fotográfica. No puede estar vacío. */
  summary: z.string().min(1),

  /** Categorías de evaluación. Debe contener al menos una. */
  categories: z
    .array(
      z.object({
        /** Nombre de la categoría (p. ej. "composition", "color", "lighting"). */
        name: z.string().min(1),

        /** Puntuación numérica de 0 a 10 (inclusive). */
        score: z.number().min(0).max(10),

        /** Comentario explicativo de la puntuación. */
        comment: z.string(),
      })
    )
    .min(1),
});

/** Tipo TypeScript derivado del schema Zod. Nunca definir manualmente. */
export type CritiqueResponse = z.infer<typeof CritiqueResponseSchema>;
