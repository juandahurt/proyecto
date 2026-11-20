import { z } from 'zod';

export const LimitsResponseSchema = z.object({
  data: z.object({
    tier: z.enum(['free', 'paid']),
    uploadsRemaining: z.number().int().min(0).nullable(),
    uploadsLimit: z.number().int().positive().nullable(),
    resetDate: z.string().nullable(),
  }),
  error: z.null(),
  status: z.literal(200),
});

export type LimitsResponse = z.infer<typeof LimitsResponseSchema>;

export const IncrementCounterResponseSchema = z.object({
  data: z.object({
    count: z.number().int().positive(),
  }),
  error: z.null(),
  status: z.literal(200),
});

export type IncrementCounterResponse = z.infer<typeof IncrementCounterResponseSchema>;

export const IncrementCounterParamsSchema = z.object({
  userId: z.string().uuid(),
});

export type IncrementCounterParams = z.infer<typeof IncrementCounterParamsSchema>;

/**
 * Respuesta de `POST /api/users/me/subscribe` (u10). Hoy coincide con `LimitsResponseSchema.shape.data`
 * (tier pasa a 'paid', los tres campos numéricos/fecha a null), pero son contratos de endpoints
 * distintos: se deriva de `LimitsResponseSchema.shape.data` sin copiar los campos a mano, y no se
 * reutiliza `LimitsResponseSchema` directamente para no acoplar ambos endpoints.
 */
export const SubscribeResponseSchema = z.object({
  data: LimitsResponseSchema.shape.data.extend({}),
  error: z.null(),
  status: z.literal(200),
});

export type SubscribeResponse = z.infer<typeof SubscribeResponseSchema>;
