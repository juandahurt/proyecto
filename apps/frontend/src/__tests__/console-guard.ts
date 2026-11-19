/**
 * Guarda global de consola (C-75). Se instala una vez al cargar `jest.setup.ts`, por lo que corre en
 * TODOS los archivos de test y nunca se restaura. Registra cada llamada a la consola y, al terminar
 * cada test, falla si hubo alguna. Una llamada diferida (`setTimeout`) se atribuye al test que esté
 * corriendo cuando se dispara; una llamada entre tests o al cargar un módulo falla el test siguiente. Un test que necesite escribir en la consola
 * debe declararlo con `allowConsole(razon)`; el valor por defecto es el silencio total.
 */

export const GUARDED_METHODS = [
  'log',
  'info',
  'warn',
  'error',
  'debug',
  'trace',
  'dir',
  'table',
] as const;
export type GuardedMethod = (typeof GUARDED_METHODS)[number];

interface RecordedCall {
  method: GuardedMethod;
  args: unknown[];
}

type ConsoleLike = Record<GuardedMethod, (...args: unknown[]) => void>;

let originals: Partial<ConsoleLike> | null = null;
let calls: RecordedCall[] = [];
let allowed: string | null = null;

function describeArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  try {
    return JSON.stringify(arg) ?? String(arg);
  } catch {
    return String(arg);
  }
}

/**
 * Sustituye los métodos de la consola por registradores silenciosos. Se llama UNA vez, al cargar
 * `jest.setup.ts`, antes de que se importe ningún archivo de test ni de producción: así un alias
 * guardado a nivel de módulo (`const dbg = console.error`) ya apunta al registrador.
 */
export function installConsoleGuard(): void {
  if (originals === null) {
    originals = {};
    const target = console as unknown as ConsoleLike;
    for (const method of GUARDED_METHODS) {
      originals[method] = target[method];
    }
  }
  const target = console as unknown as ConsoleLike;
  for (const method of GUARDED_METHODS) {
    target[method] = (...args: unknown[]) => {
      calls.push({ method, args });
    };
  }
}

/** Borra las llamadas registradas y el permiso del test. Lo usa el `afterEach` global. */
export function resetConsoleGuard(): void {
  calls = [];
  allowed = null;
}

/** Devuelve los métodos originales de la consola (solo para pruebas de la propia guarda). */
export function restoreConsole(): void {
  if (originals === null) return;
  const target = console as unknown as ConsoleLike;
  for (const method of GUARDED_METHODS) {
    const original = originals[method];
    if (original) target[method] = original;
  }
}

/** Lanza si hubo alguna llamada a la consola, nombrando el método y los argumentos. */
export function assertConsoleSilent(): void {
  if (calls.length === 0) return;
  const detail = calls
    .map((c) => `console.${c.method}(${c.args.map(describeArg).join(', ')})`)
    .join('\n  ');
  throw new Error(`The console was written to during the test:\n  ${detail}`);
}

/** Permite escribir en la consola solo en el test actual. Exige una razón no vacía. */
export function allowConsole(reason: string): void {
  if (typeof reason !== 'string' || reason.trim() === '') {
    throw new Error('allowConsole(reason) requires a non-empty reason');
  }
  allowed = reason;
}

/** Usado por el `afterEach` global de `jest.setup.ts`. */
export function isConsoleAllowed(): boolean {
  return allowed !== null;
}
