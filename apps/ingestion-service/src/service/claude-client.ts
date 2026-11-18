import Anthropic from '@anthropic-ai/sdk';
import { ClaudeVisionResponse, ClaudeVisionResponseSchema } from '@proyecto/shared-types';
import { AnthropicIntegrationError } from './anthropic-error';

/**
 * Nombre del modelo Claude a usar para las críticas de imagen.
 * Este string debe aparecer literalmente en el código (C10, FR-2).
 */
const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022';

/**
 * Timeout por defecto para llamadas a la API de Anthropic: 30 000 ms (FR-3.3).
 */
const DEFAULT_CLAUDE_TIMEOUT_MS = 30_000;

/**
 * Lee CLAUDE_TIMEOUT_MS en cada llamada (entero > 0). Ausente o inválido → 30 000.
 */
function resolveTimeoutMs(): number {
  const raw = process.env.CLAUDE_TIMEOUT_MS;
  if (raw === undefined || !/^\d+$/.test(raw.trim())) return DEFAULT_CLAUDE_TIMEOUT_MS;
  const n = Number(raw.trim());
  return Number.isSafeInteger(n) && n > 0 ? n : DEFAULT_CLAUDE_TIMEOUT_MS;
}

/**
 * Distingue timeout/abort del resto de errores del SDK/red.
 * Clases del SDK: APIConnectionTimeoutError y APIUserAbortError (el SDK lanza esta última
 * cuando nuestro AbortSignal.timeout dispara). También DOMException TimeoutError/AbortError.
 */
function isTimeoutError(err: unknown): boolean {
  if (err instanceof Anthropic.APIConnectionTimeoutError) return true;
  if (err instanceof Anthropic.APIUserAbortError) return true;
  const name = (err as { name?: string } | null)?.name;
  return name === 'TimeoutError' || name === 'AbortError';
}

/**
 * Respuesta stub hard-codeada para usar cuando ANTHROPIC_API_KEY no está definida.
 * Confidence HIGH, 5 categories con ids CAT-1..CAT-5, nombres correctos,
 * scores plausibles y al menos 2 frases de feedback por categoría.
 */
const STUB_RESPONSE: ClaudeVisionResponse = {
  confidence: 'HIGH',
  categories: [
    {
      id: 'CAT-1',
      name: 'Composition',
      score: 72,
      feedback:
        'The overall composition demonstrates a good understanding of balance and visual weight. ' +
        "Consider applying the rule of thirds more deliberately to strengthen the focal point and guide the viewer's eye through the piece.",
    },
    {
      id: 'CAT-2',
      name: 'Proportions',
      score: 68,
      feedback:
        'Proportional relationships between elements are mostly accurate, though some minor discrepancies are noticeable in the figure study. ' +
        'Practicing gesture drawing and measuring techniques will help you refine the relative sizes of anatomical landmarks.',
    },
    {
      id: 'CAT-3',
      name: 'Line Quality',
      score: 75,
      feedback:
        'Your line work shows confidence and intentionality, with clean strokes that define form effectively. ' +
        'Varying line weight more consistently—using thicker lines for outlines and thinner lines for interior detail—will add depth and visual interest.',
    },
    {
      id: 'CAT-4',
      name: 'Values (Shading)',
      score: 60,
      feedback:
        'The shading establishes a basic light and shadow relationship, but the value range could be expanded significantly. ' +
        'Push your darkest darks and lightest lights further apart to create stronger contrast and a more convincing sense of three-dimensionality.',
    },
    {
      id: 'CAT-5',
      name: 'Perspective',
      score: 55,
      feedback:
        'The perspective construction has the right intent but several convergence lines deviate from a consistent vanishing point. ' +
        'Working with a physical ruler or digital grid to establish accurate vanishing points before adding detail will help you build a more structurally sound drawing.',
    },
  ],
};

/**
 * Llama a la API de Claude Vision para obtener una crítica categorizada de una imagen.
 *
 * - Si `process.env.ANTHROPIC_API_KEY` NO está definido: devuelve el stub hard-codeado
 *   (confidence HIGH, 5 categories con datos ficticios pero schema-válidos).
 * - Si `process.env.ANTHROPIC_API_KEY` SÍ está definido: llama a `claude-3-5-sonnet-20241022`
 *   con timeout de CLAUDE_TIMEOUT_MS (def. 30 000 ms), instruyendo a Claude a devolver JSON con el schema C10 exacto.
 *
 * @param imageBuffer - Buffer con los bytes de la imagen (JPEG, PNG o WebP).
 * @returns Promesa que resuelve a un objeto ClaudeVisionResponse validado por Zod.
 * @throws AnthropicIntegrationError (kind timeout | network | bad-response) si la llamada real falla
 *         o si la respuesta no pasa validación C10.
 */
export async function callClaudeVision(imageBuffer: Buffer): Promise<ClaudeVisionResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    // Stub path: devolver datos ficticios pero schema-válidos
    return STUB_RESPONSE;
  }

  // Rama real: llamar a Claude via @anthropic-ai/sdk (importación estática en el módulo)
  // maxRetries: 0 — C10 «No retry»: el SDK no reintenta; la espera máxima es el timeout
  const client = new Anthropic({ apiKey, maxRetries: 0 });

  const base64Image = imageBuffer.toString('base64');

  // Detectar media type por magic number (simplificado para el prompt)
  let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg';
  if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) {
    mediaType = 'image/png';
  } else if (
    imageBuffer[0] === 0x52 &&
    imageBuffer[1] === 0x49 &&
    imageBuffer[2] === 0x46 &&
    imageBuffer[3] === 0x46
  ) {
    mediaType = 'image/webp';
  }

  const systemPrompt = `You are an expert art critic specializing in drawing technique evaluation.
Analyze the provided image and return ONLY a JSON object with EXACTLY this structure, no additional text:
{
  "confidence": "<HIGH|MEDIUM|LOW>",
  "categories": [
    { "id": "CAT-1", "name": "Composition", "score": <integer 0-100>, "feedback": "<at least 2 sentences>" },
    { "id": "CAT-2", "name": "Proportions", "score": <integer 0-100>, "feedback": "<at least 2 sentences>" },
    { "id": "CAT-3", "name": "Line Quality", "score": <integer 0-100>, "feedback": "<at least 2 sentences>" },
    { "id": "CAT-4", "name": "Values (Shading)", "score": <integer 0-100>, "feedback": "<at least 2 sentences>" },
    { "id": "CAT-5", "name": "Perspective", "score": <integer 0-100>, "feedback": "<at least 2 sentences>" }
  ]
}
Rules:
- confidence: HIGH if you can clearly evaluate all 5 categories, MEDIUM if partially, LOW if the image is unclear or not a drawing.
- Always include all 5 categories exactly as specified.
- score must be an integer between 0 and 100.
- feedback must be at least 2 sentences providing actionable critique.
- Return ONLY the JSON object, no markdown, no explanation.`;

  let response: Awaited<ReturnType<typeof client.messages.create>>;
  try {
    response = await client.messages.create(
      {
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: 'Please evaluate this drawing and return the critique JSON as instructed.',
              },
            ],
          },
        ],
      },
      {
        signal: AbortSignal.timeout(resolveTimeoutMs()),
      }
    );
  } catch (err) {
    if (isTimeoutError(err)) {
      throw new AnthropicIntegrationError('timeout', 'Claude request timed out', err);
    }
    throw new AnthropicIntegrationError('network', 'Claude request failed', err);
  }

  // Extraer texto de la respuesta
  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new AnthropicIntegrationError('bad-response', 'Claude returned no text content');
  }

  // Parsear JSON y validar con el schema C10
  let parsed: unknown;
  try {
    parsed = JSON.parse(textContent.text.trim());
  } catch (err) {
    throw new AnthropicIntegrationError(
      'bad-response',
      `Claude response is not valid JSON: ${(err as Error).message}`,
      err
    );
  }

  const result = ClaudeVisionResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new AnthropicIntegrationError(
      'bad-response',
      `Claude response does not match C10 schema: ${result.error.message}`,
      result.error
    );
  }

  return result.data;
}
