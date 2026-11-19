import '@testing-library/jest-dom';
import {
  assertConsoleSilent,
  installConsoleGuard,
  isConsoleAllowed,
  resetConsoleGuard,
} from './src/__tests__/console-guard';

// Una sola vez, al cargar este archivo (antes de importar tests o código de producción): los alias
// de `console` guardados a nivel de módulo ya apuntan a la guarda.
installConsoleGuard();

// Se comprueba al terminar cada test y solo entonces se reinicia: lo que se escriba entre dos tests
// o al cargar un módulo falla el test siguiente en lugar de perderse.
afterEach(() => {
  try {
    if (!isConsoleAllowed()) assertConsoleSilent();
  } finally {
    resetConsoleGuard();
  }
});
