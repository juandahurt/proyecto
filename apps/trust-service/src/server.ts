import express, { Application, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { healthHandler } from './handlers/health';
import { createOnboardingRouter } from './handlers/onboarding';
import { createPolicyRouter } from './handlers/policy';
import { createDatabase } from './service/database';
import { createOnboardingRepository, OnboardingRepository } from './service/onboarding-repository';
import { requireAuth } from '@proyecto/auth-middleware';
import { createHistoryRouter } from './handlers/history';
import { FetchFn } from './service/ingestion-client';

const DEFAULT_TIMEOUT_MS = 5000;

function readTimeout(name: string): number {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

export interface AppDeps {
  db?: Database.Database;
  repo?: OnboardingRepository;
  policyContent?: string;
  fetchFn?: FetchFn;
  ingestionUrl?: string;
  identityUrl?: string;
  ingestionTimeoutMs?: number;
  identityTimeoutMs?: number;
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

  // GET /api/policy — política de datos estática, protegida por requireAuth
  app.use('/api/policy', requireAuth, createPolicyRouter({ policyContent: deps?.policyContent }));

  // DELETE /api/history — orquesta la cascada best-effort hacia ingestion e identity
  const ingestionUrl = deps?.ingestionUrl ?? process.env.INGESTION_URL;
  if (!ingestionUrl) {
    throw new Error('INGESTION_URL is required');
  }
  const identityUrl = deps?.identityUrl ?? process.env.IDENTITY_URL;
  if (!identityUrl) {
    throw new Error('IDENTITY_URL is required');
  }
  const ingestionTimeoutMs = deps?.ingestionTimeoutMs ?? readTimeout('INGESTION_TIMEOUT_MS');
  const identityTimeoutMs = deps?.identityTimeoutMs ?? readTimeout('IDENTITY_TIMEOUT_MS');
  const fetchFn = deps?.fetchFn ?? fetch;

  app.use(
    '/api/history',
    createHistoryRouter({
      fetchFn,
      ingestionUrl,
      identityUrl,
      ingestionTimeoutMs,
      identityTimeoutMs,
    })
  );

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
