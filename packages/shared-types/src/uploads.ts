import { z } from 'zod';

/**
 * Schema Zod para el body de la respuesta 202 del endpoint POST /api/uploads.
 * Fuente autoritativa del contrato de respuesta de upload exitoso.
 *
 * Nota: en esta tarea (u1-T01) el body solo incluye uploadId.
 * Los campos categories, confidence y status real ("ready"/"low_confidence")
 * los añade u2-T01 cuando aterrice la integración con la API de Claude.
 */
export const UploadIdResponseSchema = z.object({
  data: z.object({
    /** UUID del upload generado en el servidor. Nunca viene del cliente. */
    uploadId: z.string().uuid(),
  }),
  error: z.null(),
  status: z.literal(202),
});

/** Tipo TypeScript derivado del schema Zod. Nunca definir manualmente. */
export type UploadIdResponse = z.infer<typeof UploadIdResponseSchema>;
