/**
 * Error propio del dominio para fallos en la integración con la API de Anthropic.
 * Todos los errores que provengan de la capa de comunicación con Anthropic deben
 * envolverse en esta clase antes de propagarse al caller.
 */
export class AnthropicIntegrationError extends Error {
  /**
   * Categoría del fallo.
   * - "stub-error": el stub fue configurado en modo error (solo tests)
   * - "network": error de red al llamar a la API
   * - "timeout": la API no respondió en el tiempo esperado
   * - "bad-response": la respuesta de la API no cumple el schema esperado
   */
  public readonly kind: string;

  /**
   * Causa original del error (opcional). Preserva la cadena de errores
   * para diagnóstico sin exponer detalles al cliente HTTP.
   */
  public override readonly cause?: unknown;

  constructor(kind: string, message: string, cause?: unknown) {
    super(message);
    this.name = 'AnthropicIntegrationError';
    this.kind = kind;
    this.cause = cause;

    // Mantiene el prototipo correcto en entornos con transpilación de clases.
    Object.setPrototypeOf(this, AnthropicIntegrationError.prototype);
  }
}
