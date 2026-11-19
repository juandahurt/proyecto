import { TrendOptions } from './trend-calculator';

export type TrendEnv = Record<string, string | undefined>;

const DEFAULTS: TrendOptions = { minUploads: 4, slopeImproving: 2, slopeWorsening: -2 };

/** Lee un número de `env`; ausente -> default. Nunca repite el valor en el mensaje. */
function readNumber(env: TrendEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined) return fallback;
  const value = raw.trim() === '' ? NaN : Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  return value;
}

/**
 * Carga la configuración de tendencias desde el objeto de entorno recibido
 * (único lugar donde se leen TREND_*). Lanza con el nombre de la variable
 * inválida: pensado para fallar al arrancar.
 */
export function loadTrendConfig(env: TrendEnv): TrendOptions {
  const minUploads = readNumber(env, 'TREND_MIN_UPLOADS', DEFAULTS.minUploads);
  if (!Number.isInteger(minUploads) || minUploads < 2) {
    throw new Error('TREND_MIN_UPLOADS must be an integer >= 2');
  }
  const slopeImproving = readNumber(env, 'TREND_SLOPE_IMPROVING', DEFAULTS.slopeImproving);
  const slopeWorsening = readNumber(env, 'TREND_SLOPE_WORSENING', DEFAULTS.slopeWorsening);
  if (slopeImproving < slopeWorsening) {
    throw new Error('TREND_SLOPE_IMPROVING must be >= TREND_SLOPE_WORSENING');
  }
  return { minUploads, slopeImproving, slopeWorsening };
}
