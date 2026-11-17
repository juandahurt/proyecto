import { z } from 'zod';

/**
 * Schema Zod para la respuesta de GET /api/policy.
 * Fuente autoritativa del contrato; el tipo se deriva con z.infer<>.
 */
export const PolicyResponseSchema = z.object({
  data: z.object({
    content: z.string().min(1),
  }),
  error: z.null(),
  status: z.literal(200),
});

export type PolicyResponse = z.infer<typeof PolicyResponseSchema>;
