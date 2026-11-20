import express, { Application, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { requireAuth } from '@proyecto/auth-middleware';
import { ClaudeVisionResponse } from '@proyecto/shared-types';
import { healthHandler } from './handlers/health';
import { createUploadsRouter } from './handlers/uploads';
import { createDatabase } from './service/database';
import { createUploadRepository, UploadRepository } from './service/upload-repository';
import { callClaudeVision } from './service/claude-client';
import { createThumbnailHandler } from './handlers/thumbnail';
import { createDeleteUserDataRouter } from './handlers/delete-user-data';
import { FetchFn } from './service/identity-client';

const MIN_SIGNING_KEY_LENGTH = 32;
const DEFAULT_IDENTITY_TIMEOUT_MS = 5000;

export interface AppDeps {
  db?: Database.Database;
  repo?: UploadRepository;
  /**
   * Cliente Claude Vision inyectable. En tests se inyecta un stub que devuelve
   * datos fijos sin llamar a la red. En producción se usa callClaudeVision.
   */
  claudeClient?: (buf: Buffer) => Promise<ClaudeVisionResponse>;
  /** Clave HMAC de las URL firmadas de miniatura; si falta, process.env.THUMBNAIL_SIGNING_KEY. */
  signingKey?: string;
  /** Reloj en ms epoch (por defecto Date.now); inyectable en tests. */
  now?: () => number;
  /** Fetch inyectable para el cliente de identity (tests). Por defecto el global. */
  fetchFn?: FetchFn;
  /** Base URL de identity-service; si falta, process.env.IDENTITY_URL (lanza si no hay ninguna). */
  identityUrl?: string;
  /** Timeout en ms para llamadas a identity; si falta, process.env.IDENTITY_TIMEOUT_MS o 5000. */
  identityTimeoutMs?: number;
}

function readIdentityTimeout(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_IDENTITY_TIMEOUT_MS;
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

  const now = deps?.now ?? Date.now;
  const signingKey = deps?.signingKey ?? process.env.THUMBNAIL_SIGNING_KEY ?? '';
  // Falla al arrancar: nunca se firma con una clave ausente o débil
  if (signingKey.length < MIN_SIGNING_KEY_LENGTH) {
    throw new Error(
      `THUMBNAIL_SIGNING_KEY is required and must be at least ${MIN_SIGNING_KEY_LENGTH} characters`
    );
  }

  const identityUrl = deps?.identityUrl ?? process.env.IDENTITY_URL;
  if (!identityUrl) {
    throw new Error('IDENTITY_URL is required');
  }
  const identityTimeoutMs =
    deps?.identityTimeoutMs ?? readIdentityTimeout(process.env.IDENTITY_TIMEOUT_MS);
  const fetchFn = deps?.fetchFn ?? fetch;

  // GET /api/uploads/:uploadId/thumbnail — pública (URL firmada); ANTES de requireAuth
  app.get('/api/uploads/:uploadId/thumbnail', createThumbnailHandler({ repo, signingKey, now }));

  // Resto de /api/uploads — protegido por requireAuth
  app.use(
    '/api/uploads',
    requireAuth,
    createUploadsRouter({
      repo,
      claudeClient,
      signingKey,
      now,
      fetchFn,
      identityUrl,
      identityTimeoutMs,
    })
  );

  // /api/internal — network-trusted, sin requireAuth (mismo patrón que increment-counter)
  app.use('/api/internal', createDeleteUserDataRouter({ repo }));

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
