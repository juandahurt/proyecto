import express, { Application, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { requireAuth } from '@proyecto/auth-middleware';
import { ClaudeVisionResponse } from '@proyecto/shared-types';
import { healthHandler } from './handlers/health';
import { createUploadsRouter } from './handlers/uploads';
import { createDatabase } from './service/database';
import { createUploadRepository, UploadRepository } from './service/upload-repository';
import { callClaudeVision } from './service/claude-client';

export interface AppDeps {
  db?: Database.Database;
  repo?: UploadRepository;
  /**
   * Cliente Claude Vision inyectable. En tests se inyecta un stub que devuelve
   * datos fijos sin llamar a la red. En producción se usa callClaudeVision.
   */
  claudeClient?: (buf: Buffer) => Promise<ClaudeVisionResponse>;
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
  const claudeClient = deps?.claudeClient ?? callClaudeVision;

  // POST /api/uploads — protegido por requireAuth
  app.use('/api/uploads', requireAuth, createUploadsRouter({ repo, claudeClient }));

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
