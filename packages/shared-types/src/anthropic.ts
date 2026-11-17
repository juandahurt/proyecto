import { z } from 'zod';

// =============================================================================
// C10 — Claude Vision Response (u2-ai-critique)
// Schema autoritativo para la respuesta de la API de Claude Vision.
// Los tipos TypeScript se derivan de estos schemas via z.infer<>.
// =============================================================================

/**
 * Enum de IDs de categoría de crítica de dibujo artístico (C10).
 */
export const CategoryIdSchema = z.enum(['CAT-1', 'CAT-2', 'CAT-3', 'CAT-4', 'CAT-5']);

/**
 * Enum de nombres de categoría de crítica de dibujo artístico (C10).
 */
export const CategoryNameSchema = z.enum([
  'Composition',
  'Proportions',
  'Line Quality',
  'Values (Shading)',
  'Perspective',
]);

/**
 * Schema Zod para una categoría individual de la crítica Claude Vision (C10).
 * Campos: id (CAT-1..CAT-5), name (enum), score (0-100), feedback (≥1 char).
 */
export const ClaudeVisionCategorySchema = z.object({
  /** Identificador de la categoría: CAT-1 .. CAT-5 */
  id: CategoryIdSchema,

  /** Nombre de la categoría según el enum C10 */
  name: CategoryNameSchema,

  /** Puntuación entera de 0 a 100 (inclusive) */
  score: z.number().int().min(0).max(100),

  /** Texto de feedback. Debe tener al menos 1 caracter. */
  feedback: z.string().min(1),
});

/** Tipo TypeScript derivado. Nunca definir manualmente. */
export type ClaudeVisionCategory = z.infer<typeof ClaudeVisionCategorySchema>;

/**
 * Schema Zod para la respuesta completa de Claude Vision (C10).
 * Confidence: HIGH | MEDIUM | LOW.
 * Categories: array de exactamente 5 elementos (minItems 5, maxItems 5).
 */
export const ClaudeVisionResponseSchema = z.object({
  /** Confianza general de la crítica */
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),

  /** Array de exactamente 5 categorías de crítica */
  categories: z.array(ClaudeVisionCategorySchema).min(5).max(5),
});

/** Tipo TypeScript derivado. Nunca definir manualmente. */
export type ClaudeVisionResponse = z.infer<typeof ClaudeVisionResponseSchema>;

// =============================================================================
// Walking Skeleton schemas — NO modificar (apps/backend/ depende de ellos)
// =============================================================================

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
