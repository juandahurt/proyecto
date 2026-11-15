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
