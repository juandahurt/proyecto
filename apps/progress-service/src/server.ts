import express, { Application, Request, Response } from 'express';
import { requireAuth } from '@proyecto/auth-middleware';
import { healthHandler } from './handlers/health';
import { createHistoryHandler } from './handlers/history';
import { FetchFn } from './service/ingestion-client';

export interface AppDeps {
  fetchFn?: FetchFn;
  ingestionUrl?: string;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Crea la aplicacion Express. Lanza si falta INGESTION_URL (falla al arrancar).
 */
export function createApp(deps?: AppDeps): Application {
  const ingestionUrl = deps?.ingestionUrl ?? process.env.INGESTION_URL;
  if (!ingestionUrl) {
    throw new Error('INGESTION_URL is required');
  }
  const envTimeout = Number.parseInt(process.env.INGESTION_TIMEOUT_MS ?? '', 10);
  const timeoutMs =
    deps?.timeoutMs ??
    (Number.isFinite(envTimeout) && envTimeout > 0 ? envTimeout : DEFAULT_TIMEOUT_MS);
  const fetchFn = deps?.fetchFn ?? fetch;

  const app = express();
  app.get('/health', healthHandler);
  app.get(
    '/api/trends/history',
    requireAuth,
    createHistoryHandler({ fetchFn, ingestionUrl, timeoutMs })
  );

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ data: null, error: 'Not Found', status: 404 });
  });

  return app;
}
