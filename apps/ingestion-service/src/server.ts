import express, { Application, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { requireAuth } from '@proyecto/auth-middleware';
import { healthHandler } from './handlers/health';
import { createUploadsRouter } from './handlers/uploads';
import { createDatabase } from './service/database';
import { createUploadRepository, UploadRepository } from './service/upload-repository';

export interface AppDeps {
  db?: Database.Database;
  repo?: UploadRepository;
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

  // GET /health — sin autenticación
  app.get('/health', healthHandler);

  // Dependencias de /api/uploads: inyectadas (tests) o por defecto (producción)
  const db = deps?.db ?? createDatabase();
  const repo = deps?.repo ?? createUploadRepository(db);

  // POST /api/uploads — protegido por requireAuth
  app.use('/api/uploads', requireAuth, createUploadsRouter({ repo }));

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
