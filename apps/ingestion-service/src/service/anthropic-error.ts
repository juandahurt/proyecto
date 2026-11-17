/**
 * Error de dominio para fallos de integración con la API de Anthropic.
 * Todo fallo de la capa de comunicación con Claude se envuelve en esta clase.
 * (Copia propia de ingestion-service; no se importa del backend.)
 */
export type AnthropicErrorKind = 'timeout' | 'network' | 'bad-response';

export class AnthropicIntegrationError extends Error {
  /** Categoría: 'timeout' | 'network' | 'bad-response'. */
  public readonly kind: AnthropicErrorKind;

  /** Causa original, para diagnóstico; nunca se expone al cliente HTTP. */
  public override readonly cause?: unknown;

  constructor(kind: AnthropicErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = 'AnthropicIntegrationError';
    this.kind = kind;
    this.cause = cause;
    Object.setPrototypeOf(this, AnthropicIntegrationError.prototype);
  }
}
