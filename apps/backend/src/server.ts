import express, { Application, Request, Response } from 'express';
import { healthHandler } from './handlers/health';
import { createCritiquesRouter } from './handlers/critiques';
import { AnthropicClient } from './service/anthropic-client';
import { CritiqueRepository } from './service/critique-repository';
import { createDatabase } from './service/database';

export interface AppDeps {
  client?: AnthropicClient;
  repo?: CritiqueRepository;
}

/**
 * Crea la aplicacion Express con todas las rutas registradas.
 *
 * @param deps - Dependencias opcionales para inyeccion en tests.
 *   Si no se pasan, se crean instancias de produccion por defecto.
 * @returns Instancia de Application de Express.
 */
export function createApp(deps?: AppDeps): Application {
  const app = express();

  app.use(express.json());

  // Ruta existente — no se toca (WS-T02)
  app.get('/health', healthHandler);

  // Dependencias de /critiques: inyectadas (tests) o por defecto (produccion)
  const client = deps?.client ?? new AnthropicClient();
  const repo = deps?.repo ?? new CritiqueRepository(createDatabase());

  // Ruta nueva — POST /critiques
  app.use('/critiques', createCritiquesRouter({ client, repo }));

  // Fallback 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      data: null,
      error: 'Not Found',
      status: 404,
    });
  });

  return app;
}
