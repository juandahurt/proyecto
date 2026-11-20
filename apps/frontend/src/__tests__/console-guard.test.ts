import { allowConsole, assertConsoleSilent, resetConsoleGuard } from './console-guard';

// Alias guardados al CARGAR el módulo de test (después de jest.setup.ts, antes de cualquier test):
// solo se detectan si la guarda ya estaba instalada cuando se cargó este archivo (F-01).
const aliasError = console.error;
const { warn: aliasWarn } = console;

/**
 * Todas las propiedades función de `console` (propias y de su cadena de prototipos), calculadas
 * aquí de forma independiente de la guarda. Se excluyen `constructor`, lo heredado de
 * `Object.prototype`, el constructor `Console`, los internos con `_` y `getBuffer` (lo llama el
 * ejecutor de Jest). Un método que otra versión de Node añada a `console` entra solo.
 */
function consoleFunctionNames(): string[] {
  const objectProto = new Set(Object.getOwnPropertyNames(Object.prototype));
  const target = console as unknown as Record<string, unknown>;
  const names = new Set<string>();
  let obj: object | null = console;
  while (obj && obj !== Object.prototype) {
    for (const key of Object.getOwnPropertyNames(obj)) {
      if (objectProto.has(key) || key === 'getBuffer') continue;
      if (key.startsWith('_') || /^[A-Z]/.test(key)) continue;
      if (typeof target[key] === 'function') names.add(key);
    }
    obj = Object.getPrototypeOf(obj);
  }
  return [...names].sort();
}

describe('console-guard', () => {
  it('la lista cubre al menos los métodos habituales y los que usaban las mutaciones M07 a M10', () => {
    expect(consoleFunctionNames()).toEqual(
      expect.arrayContaining([
        'log',
        'info',
        'warn',
        'error',
        'debug',
        'trace',
        'dir',
        'table',
        'assert',
        'group',
        'groupCollapsed',
        'count',
        'countReset',
        'dirxml',
        'time',
        'timeLog',
        'timeEnd',
      ])
    );
  });

  it.each(consoleFunctionNames())(
    'console.%s hace que assertConsoleSilent lance y nombre el método',
    (method) => {
      allowConsole('probar la propia guarda: el afterEach global no debe fallar este test');
      (console as unknown as Record<string, (...a: unknown[]) => void>)[method]('valor-secreto');
      expect(() => assertConsoleSilent()).toThrow(
        new RegExp(`console\\.${method}\\(.*valor-secreto`)
      );
    }
  );

  it('un alias de console.error guardado a nivel de módulo también se detecta', () => {
    allowConsole('probar la propia guarda: el afterEach global no debe fallar este test');
    aliasError('por-alias');
    expect(() => assertConsoleSilent()).toThrow(/console\.error\(por-alias\)/);
  });

  it('un alias desestructurado de console.warn también se detecta', () => {
    allowConsole('probar la propia guarda: el afterEach global no debe fallar este test');
    aliasWarn('por-alias-2');
    expect(() => assertConsoleSilent()).toThrow(/console\.warn\(por-alias-2\)/);
  });

  it('sin llamadas a la consola no lanza', () => {
    expect(() => assertConsoleSilent()).not.toThrow();
  });

  it('tras console.error("x") lanza y nombra el método y el argumento', () => {
    allowConsole('probar la propia guarda: el afterEach global no debe fallar este test');
    console.error('x');
    expect(() => assertConsoleSilent()).toThrow(/console\.error\(x\)/);
  });

  it('el espía del test anterior no contamina a este', () => {
    expect(() => assertConsoleSilent()).not.toThrow();
  });

  it('allowConsole("") lanza, y con solo espacios también', () => {
    expect(() => allowConsole('')).toThrow(/non-empty reason/);
    expect(() => allowConsole('   ')).toThrow(/non-empty reason/);
  });

  it('resetConsoleGuard reinicia las llamadas registradas', () => {
    allowConsole('probar la propia guarda: el afterEach global no debe fallar este test');
    console.warn('antes');
    resetConsoleGuard();
    expect(() => assertConsoleSilent()).not.toThrow();
  });
});
