import '@testing-library/jest-dom';
import {
  assertConsoleSilent,
  installConsoleGuard,
  isConsoleAllowed,
  restoreConsole,
} from './src/__tests__/console-guard';

beforeEach(() => {
  installConsoleGuard();
});

// Se comprueba ANTES de restaurar: restaurar primero borraría la evidencia.
afterEach(() => {
  try {
    if (!isConsoleAllowed()) assertConsoleSilent();
  } finally {
    restoreConsole();
  }
});
