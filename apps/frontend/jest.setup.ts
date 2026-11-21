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

// `recharts` (u0-T06) mide su contenedor con `ResizeObserver`, no disponible en `jsdom`. Un mock
// mínimo que no hace nada evita que `ResponsiveContainer` reviente o quede en 0x0 de forma
// intermitente: el tamaño real no importa para los tests (solo se verifica contenido/atributos del
// SVG, no dimensiones en píxeles).
class MockResizeObserver {
  observe() {
    // no-op: jsdom no tiene layout real, no hay nada que medir.
  }
  unobserve() {
    // no-op
  }
  disconnect() {
    // no-op
  }
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = MockResizeObserver;

// `ResponsiveContainer` lee `getBoundingClientRect()` del contenedor al montar, además de
// `ResizeObserver`; en `jsdom` sin layout real siempre da 0x0, lo que dispara el warning de
// recharts "width(0) and height(0)" (y hace fallar la guarda de consola). El tamaño exacto no
// importa para los tests (no se verifican píxeles), solo que sea mayor que 0.
Element.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
  return {
    width: 300,
    height: 160,
    top: 0,
    left: 0,
    bottom: 160,
    right: 300,
    x: 0,
    y: 0,
    toJSON() {
      return this;
    },
  } as DOMRect;
};

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
