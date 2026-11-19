import express, { Application, Request, Response } from 'express';
import { requireAuth } from '@proyecto/auth-middleware';
import { healthHandler } from './handlers/health';
import { createHistoryHandler } from './handlers/history';
import { createTrendsHandler } from './handlers/trends';
import { loadTrendConfig } from './service/trend-config';
import { FetchFn } from './service/ingestion-client';

export interface AppDeps {
  fetchFn?: FetchFn;
  ingestionUrl?: string;
  identityUrl?: string;
  identityTimeoutMs?: number;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5000;

function readTimeout(name: string): number {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

/**
 * Crea la aplicacion Express. Lanza si falta INGESTION_URL o IDENTITY_URL, o si TREND_* es invalida (falla al arrancar).
 */
export function createApp(deps?: AppDeps): Application {
  const ingestionUrl = deps?.ingestionUrl ?? process.env.INGESTION_URL;
  if (!ingestionUrl) {
    throw new Error('INGESTION_URL is required');
  }
  const identityUrl = deps?.identityUrl ?? process.env.IDENTITY_URL;
  if (!identityUrl) {
    throw new Error('IDENTITY_URL is required');
  }
  // C-56: falla al arrancar si TREND_* es invalida (el mensaje nombra la variable).
  const trendOptions = loadTrendConfig(process.env);
  const timeoutMs = deps?.timeoutMs ?? readTimeout('INGESTION_TIMEOUT_MS');
  const identityTimeoutMs = deps?.identityTimeoutMs ?? readTimeout('IDENTITY_TIMEOUT_MS');
  const fetchFn = deps?.fetchFn ?? fetch;

  const app = express();
  app.get('/health', healthHandler);
  app.get(
    '/api/trends/history',
    requireAuth,
    createHistoryHandler({ fetchFn, ingestionUrl, timeoutMs })
  );
  app.get(
    '/api/trends',
    requireAuth,
    createTrendsHandler({
      fetchFn,
      ingestionUrl,
      identityUrl,
      ingestionTimeoutMs: timeoutMs,
      identityTimeoutMs,
      options: trendOptions,
    })
  );

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ data: null, error: 'Not Found', status: 404 });
  });

  return app;
}
