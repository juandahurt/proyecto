import {
  ClaudeVisionResponse,
  ClaudeVisionResponseSchema,
  UploadResult,
} from '@proyecto/shared-types';
import { AnthropicIntegrationError } from './anthropic-error';

/** Derivado del contrato C1 (UploadResultSchema); no se copia el enum a mano. */
export type FallbackReason = NonNullable<UploadResult['data']['fallbackReason']>;

export type CritiqueOutcome =
  { kind: 'ready'; critique: ClaudeVisionResponse } | { kind: 'fallback'; reason: FallbackReason };

/**
 * Llama al cliente Claude y clasifica el resultado (US-3, C10).
 *
 * Orden de reglas:
 * 1. AnthropicIntegrationError: timeout -> 'timeout'; network -> 'timeout'; bad-response -> 'invalid_schema'.
 *    D-1: el enum C1 solo tiene 3 razones; un fallo de red/5xx cae en la misma familia
 *    "servicio no disponible" que el timeout.
 * 2. Cualquier otro error se re-lanza (es un bug, no baja confianza).
 * 3. Se re-valida el resultado con ClaudeVisionResponseSchema -> fallo = 'invalid_schema'.
 * 4. confidence LOW -> 'low_confidence_flag' (el schema se valida antes que LOW).
 * 5. HIGH/MEDIUM -> ready.
 */
export async function resolveCritique(
  claudeClient: (buf: Buffer) => Promise<ClaudeVisionResponse>,
  buffer: Buffer
): Promise<CritiqueOutcome> {
  let raw: unknown;
  try {
    raw = await claudeClient(buffer);
  } catch (err) {
    if (err instanceof AnthropicIntegrationError) {
      if (err.kind === 'bad-response') return { kind: 'fallback', reason: 'invalid_schema' };
      return { kind: 'fallback', reason: 'timeout' };
    }
    throw err;
  }

  const parsed = ClaudeVisionResponseSchema.safeParse(raw);
  if (!parsed.success) return { kind: 'fallback', reason: 'invalid_schema' };
  if (parsed.data.confidence === 'LOW') {
    return { kind: 'fallback', reason: 'low_confidence_flag' };
  }
  return { kind: 'ready', critique: parsed.data };
}
