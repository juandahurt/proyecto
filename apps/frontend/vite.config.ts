import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// @proyecto/shared-types se compila a CommonJS (tsc). Al ser un workspace enlazado, Vite
// no lo pasa por el plugin commonjs por defecto: se incluye explícitamente su ruta real.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    commonjsOptions: {
      include: [/node_modules/, /packages[\\/]shared-types[\\/]/],
    },
  },
  optimizeDeps: {
    include: ['@proyecto/shared-types'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api/auth': 'http://localhost:3100',
      '/api/users': 'http://localhost:3100',
      '/api/uploads': 'http://localhost:3200',
      '/api/onboarding': 'http://localhost:3300',
      '/api/trends': 'http://localhost:3400',
    },
  },
});
