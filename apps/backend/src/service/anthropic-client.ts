import { CritiqueResponse, CritiqueResponseSchema } from '@proyecto/shared-types';
import { AnthropicIntegrationError } from './anthropic-error';

/**
 * Escenarios de comportamiento del cliente (solo para tests del walking skeleton).
 * Cuando se reemplace el stub por el cliente real, esta opción controlará el
 * transporte inyectado (real vs. mock), no el comportamiento en sí.
 */
export type ClientScenario = 'success' | 'error';

export interface AnthropicClientOptions {
  /**
   * Escenario del stub:
   * - "success" (por defecto): devuelve la respuesta fija del skeleton.
   * - "error": lanza AnthropicIntegrationError con kind "stub-error".
   *
   * En el futuro, cuando se integre el cliente real, esta opción
   * inyectará process.env.ANTHROPIC_API_KEY como configuración de transporte.
   */
  scenario?: ClientScenario;
}

/**
 * Cliente de la API de Anthropic.
 *
 * Esta implementación es un STUB estático del Walking Skeleton (Bolt 1).
 * No realiza ninguna llamada de red. La capa de red real se añadirá en la
 * unidad u2-ai-critique una vez que el skeleton esté validado extremo a extremo.
 *
 * La respuesta stub cumple el schema CritiqueResponseSchema del package
 * @proyecto/shared-types, garantizando que los futuros consumidores
 * no tengan que modificar su código cuando se active el cliente real.
 */
export class AnthropicClient {
  private readonly scenario: ClientScenario;

  constructor(options: AnthropicClientOptions = {}) {
    this.scenario = options.scenario ?? 'success';
  }

  /**
   * Genera una crítica fotográfica para el texto de entrada.
   *
   * @param input - Descripción o contexto de la imagen a evaluar.
   * @returns Promesa que resuelve con una CritiqueResponse validada.
   * @throws AnthropicIntegrationError si el cliente está en modo "error".
   */
  async critique(input: string): Promise<CritiqueResponse> {
    if (this.scenario === 'error') {
      throw new AnthropicIntegrationError(
        'stub-error',
        `Stub configurado en modo error para input: "${input}"`
      );
    }

    // Respuesta fija del skeleton. La forma (campos y tipos) está fijada
    // por CritiqueResponseSchema; los textos son orientativos.
    const stubResponse = {
      summary: 'Composición equilibrada con alto contraste.',
      categories: [
        {
          name: 'composition',
          score: 8.5,
          comment: 'Regla de tercios bien aplicada.',
        },
        {
          name: 'color',
          score: 7.2,
          comment: 'Paleta armónica y saturación coherente.',
        },
        {
          name: 'lighting',
          score: 6.8,
          comment: 'Luz principal clara, sombras un poco duras.',
        },
      ],
    };

    // Validamos la respuesta stub contra el schema para garantizar la coherencia.
    // Si el schema cambia y la respuesta stub ya no lo cumple, este parse falla aquí.
    return CritiqueResponseSchema.parse(stubResponse);
  }
}
