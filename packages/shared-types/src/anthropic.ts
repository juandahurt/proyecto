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

/**
 * Schema Zod para el body del request POST /critiques.
 * Valida que el input sea un string no vacío con máximo 5000 caracteres.
 */
export const CritiqueRequestSchema = z.object({
  /** Texto de entrada para la crítica fotográfica. Mínimo 1 carácter, máximo 5000. */
  input: z.string().min(1).max(5000),
});

/** Tipo TypeScript derivado del schema Zod de request. Nunca definir manualmente. */
export type CritiqueRequest = z.infer<typeof CritiqueRequestSchema>;

/**
 * Schema Zod para un registro persistido de crítica (tal como lo devuelve el repositorio).
 * Incluye el id autoincremental y la fecha de creación.
 */
export const PersistedCritiqueSchema = z.object({
  /** Identificador autoincremental de la BD. */
  id: z.number().int().positive(),

  /** Texto de entrada original del request. */
  input: z.string().min(1),

  /** Respuesta de Anthropic deserializada desde la BD. */
  response: CritiqueResponseSchema,

  /** Timestamp de creación en formato ISO 8601 (texto, tal como lo guarda SQLite). */
  createdAt: z.string().min(1),
});

/** Tipo TypeScript derivado del schema Zod de registro persistido. Nunca definir manualmente. */
export type PersistedCritique = z.infer<typeof PersistedCritiqueSchema>;
