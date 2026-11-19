import {
  allowConsole,
  assertConsoleSilent,
  GUARDED_METHODS,
  installConsoleGuard,
} from './console-guard';

// Alias guardados al CARGAR el módulo de test (después de jest.setup.ts, antes de cualquier test):
// solo se detectan si la guarda ya estaba instalada cuando se cargó este archivo (F-01).
const aliasError = console.error;
const { warn: aliasWarn } = console;

describe('console-guard', () => {
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

  it.each(GUARDED_METHODS)('cubre console.%s', (method) => {
    allowConsole('probar la propia guarda: el afterEach global no debe fallar este test');
    (console[method] as (...a: unknown[]) => void)('valor-secreto', 42);
    expect(() => assertConsoleSilent()).toThrow(
      new RegExp(`console\\.${method}\\(valor-secreto, 42\\)`)
    );
  });

  it('allowConsole("") lanza, y con solo espacios también', () => {
    expect(() => allowConsole('')).toThrow(/non-empty reason/);
    expect(() => allowConsole('   ')).toThrow(/non-empty reason/);
  });

  it('installConsoleGuard reinicia las llamadas registradas', () => {
    allowConsole('probar la propia guarda: el afterEach global no debe fallar este test');
    console.warn('antes');
    installConsoleGuard();
    expect(() => assertConsoleSilent()).not.toThrow();
  });
});
