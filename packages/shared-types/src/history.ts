import { z } from 'zod';

/**
 * Body de `DELETE /api/history` (u13-T01). El literal exacto `'DELETE'` es el
 * único valor aceptado — sin variantes de mayúsculas ni espacios. `204` no
 * tiene cuerpo de respuesta, por lo que no hace falta un schema de respuesta.
 */
export const DeleteHistoryRequestSchema = z.object({
  confirmation: z.literal('DELETE'),
});

export type DeleteHistoryRequest = z.infer<typeof DeleteHistoryRequestSchema>;
