import {
  allowConsole,
  assertConsoleSilent,
  GUARDED_METHODS,
  installConsoleGuard,
} from './console-guard';

describe('console-guard', () => {
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
