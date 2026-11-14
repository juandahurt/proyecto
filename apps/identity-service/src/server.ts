import express, { Application, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { healthHandler } from './handlers/health';
import { createAuthRouter } from './handlers/auth';
import { createDatabase } from './service/database';
import { createUserRepository, UserRepository } from './service/user-repository';

export interface AppDeps {
  db?: Database.Database;
  repo?: UserRepository;
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

  // GET /health
  app.get('/health', healthHandler);

  // Dependencias de /api/auth: inyectadas (tests) o por defecto (producción)
  const db = deps?.db ?? createDatabase();
  const repo = deps?.repo ?? createUserRepository(db);

  // POST /api/auth/register y POST /api/auth/login
  app.use('/api/auth', createAuthRouter({ repo }));

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
