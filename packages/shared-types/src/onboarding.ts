/**
 * Módulo de constantes y schemas para el onboarding de Estudio.
 *
 * Los literales de los 3 checkboxes son el copy exacto (byte-por-byte) de
 * stories.md AC-11.2, confirmado por el humano como "required copy for the
 * MVP onboarding". No alterar mayúsculas, puntuación ni caracteres.
 *
 * Los `--` del primer checkbox son dos guiones ASCII simples (0x2D 0x2D),
 * NOT em-dash ni en-dash. El apóstrofe en "doesn't" es 0x27, NOT U+2019.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Copy literal de los 3 checkboxes (fuente: stories.md AC-11.2)
// ---------------------------------------------------------------------------

export const ONBOARDING_CHECKBOX_1 =
  "Estudio COMPLEMENTS human critique -- it doesn't replace your instructor, community, or mentors.";

export const ONBOARDING_CHECKBOX_2 =
  'AI feedback is categorized input, not a verdict. My own judgment and human critique remain primary.';

export const ONBOARDING_CHECKBOX_3 =
  'Estudio stores my uploads and critique history. My images are NEVER used to train AI models without my explicit, separate consent. I can delete my history at any time in Settings.';

// ---------------------------------------------------------------------------
// Array ordenado de los 3 checkboxes
// ---------------------------------------------------------------------------

export const ONBOARDING_CHECKBOXES: readonly string[] = [
  ONBOARDING_CHECKBOX_1,
  ONBOARDING_CHECKBOX_2,
  ONBOARDING_CHECKBOX_3,
];

// ---------------------------------------------------------------------------
// Schema Zod: exige los 3 checkboxes en true (ninguno puede ser false u omitido)
// ---------------------------------------------------------------------------

export const OnboardingAckRequestSchema = z.object({
  checkbox1: z.literal(true),
  checkbox2: z.literal(true),
  checkbox3: z.literal(true),
});

export type OnboardingAckRequest = z.infer<typeof OnboardingAckRequestSchema>;
