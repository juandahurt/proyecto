import express, { Application, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { healthHandler } from './handlers/health';
import { createOnboardingRouter } from './handlers/onboarding';
import { createDatabase } from './service/database';
import { createOnboardingRepository, OnboardingRepository } from './service/onboarding-repository';

export interface AppDeps {
  db?: Database.Database;
  repo?: OnboardingRepository;
}

/**
 * Crea la aplicación Express con todas las rutas registradas.
 *
 * @param deps - Dependencias opcionales para inyección en tests.
 *   Si no se pasan, se crean instancias de producción por defecto.
 * @returns Instancia de Application de Express.
 */
export function createApp(deps?: AppDeps): Application {
  const app = express();

  app.use(express.json());

  // GET /health — shape skeleton uniforme
  app.get('/health', healthHandler);

  // Dependencias de /api/onboarding: inyectadas (tests) o por defecto (producción)
  const db = deps?.db ?? createDatabase();
  const repo = deps?.repo ?? createOnboardingRepository(db);

  // GET /api/onboarding y POST /api/onboarding
  app.use('/api/onboarding', createOnboardingRouter({ repo }));

  // Fallback 404
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      data: null,
      error: 'Not Found',
      status: 404,
    });
  });

  return app;
}
