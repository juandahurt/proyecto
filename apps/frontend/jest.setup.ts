import '@testing-library/jest-dom';
import {
  assertConsoleSilent,
  installConsoleGuard,
  isConsoleAllowed,
  resetConsoleGuard,
} from './src/__tests__/console-guard';

// Una sola vez, al cargar este archivo (antes de importar tests o código de producción): los alias
// de `console` guardados a nivel de módulo ya apuntan a la guarda. Sustituye todas las funciones
// de `console`, no una lista fija.
installConsoleGuard();

// Zona horaria local simulada (F-09). `process.env.TZ` no sirve aquí: el `process` del entorno de
// Jest es una copia y asignarlo no cambia la zona de ICU. En su lugar, `Intl.DateTimeFormat` sin
// `timeZone` explícito usa UTC-11 (Pacific/Pago_Pago), de modo que quitar `timeZone: 'UTC'` del
// código de producción hace fallar los tests también cuando el CI corre en TZ=UTC.
const RealDateTimeFormat = Intl.DateTimeFormat;
const LOCAL_ZONE = 'Pacific/Pago_Pago';
function ZonedDateTimeFormat(
  locales?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  return new RealDateTimeFormat(locales, { timeZone: LOCAL_ZONE, ...options });
}
ZonedDateTimeFormat.prototype = RealDateTimeFormat.prototype;
ZonedDateTimeFormat.supportedLocalesOf =
  RealDateTimeFormat.supportedLocalesOf.bind(RealDateTimeFormat);
Intl.DateTimeFormat = ZonedDateTimeFormat as unknown as typeof Intl.DateTimeFormat;

// Se comprueba al terminar cada test y solo entonces se reinicia: lo que se escriba entre dos tests
// o al cargar un módulo falla el test siguiente en lugar de perderse. Una llamada que dispare
// después de que Jest desmonte el entorno (p. ej. un `setTimeout` de 1 s en el último test) SÍ se
// pierde en silencio: es una propiedad de Jest.
afterEach(() => {
  try {
    if (!isConsoleAllowed()) assertConsoleSilent();
  } finally {
    resetConsoleGuard();
  }
});
