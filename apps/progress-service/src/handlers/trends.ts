import { Request, RequestHandler, Response } from 'express';
import { fetchLimits } from '../service/identity-client';
import { FetchFn } from '../service/ingestion-client';
import { TrendOptions } from '../service/trend-calculator';
import { buildTrendResponse } from '../service/trend-response';
import { getTrends } from '../service/trend-service';

export interface TrendsDeps {
  fetchFn: FetchFn;
  ingestionUrl: string;
  identityUrl: string;
  ingestionTimeoutMs: number;
  identityTimeoutMs: number;
  options: TrendOptions;
}

type Failure = {
  kind: 'unauthenticated' | 'upstream' | 'bad-response' | 'timeout';
  status?: number;
};

function sendFailure(res: Response, failure: Failure): void {
  switch (failure.kind) {
    case 'unauthenticated':
      res.status(401).json({ data: null, error: 'unauthenticated', status: 401 });
      return;
    case 'timeout':
      console.warn('[trends] upstream timeout');
      res.status(504).json({ data: null, error: 'Upstream timeout', status: 504 });
      return;
    case 'bad-response':
      console.warn('[trends] upstream bad response');
      res.status(502).json({ data: null, error: 'Bad upstream response', status: 502 });
      return;
    default:
      console.warn(
        failure.status === undefined
          ? '[trends] upstream error'
          : `[trends] upstream error status=${failure.status}`
      );
      res.status(502).json({ data: null, error: 'Upstream unavailable', status: 502 });
  }
}

/**
 * GET /api/trends (detras de requireAuth).
 * 1) Consulta el tier en identity; ante cualquier fallo responde error sin datos
 *    y NO llama a ingestion. Nunca asume free ni paid.
 * 2) Lee y calcula las tendencias con ingestion.
 * 3) Aplica la puerta de tier. Sin cache: cada peticion repite ambas llamadas.
 * Ignora la query del cliente y no escribe datos del usuario en los logs.
 */
export function createTrendsHandler(deps: TrendsDeps): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    const authorization = req.headers.authorization as string;

    const limits = await fetchLimits({
      authorization,
      fetchFn: deps.fetchFn,
      baseUrl: deps.identityUrl,
      timeoutMs: deps.identityTimeoutMs,
    });
    if (!limits.ok) {
      sendFailure(res, limits);
      return;
    }

    const result = await getTrends({
      authorization,
      fetchFn: deps.fetchFn,
      baseUrl: deps.ingestionUrl,
      timeoutMs: deps.ingestionTimeoutMs,
      options: deps.options,
    });
    if (!result.ok) {
      sendFailure(res, result);
      return;
    }

    res.status(200).json(buildTrendResponse(limits.tier, result.trends));
  };
}
