import { Request, RequestHandler, Response } from 'express';
import { UploadList } from '@proyecto/shared-types';
import { FetchFn, fetchUploadList } from '../service/ingestion-client';

export interface HistoryDeps {
  fetchFn: FetchFn;
  ingestionUrl: string;
  timeoutMs: number;
}

/**
 * GET /api/trends/history (detras de requireAuth).
 * Proxy al listado de ingestion con el JWT del usuario. Solo transmite: no
 * reordena, no filtra y ignora la query del cliente.
 */
export function createHistoryHandler(deps: HistoryDeps): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    const result = await fetchUploadList({
      authorization: req.headers.authorization as string,
      fetchFn: deps.fetchFn,
      baseUrl: deps.ingestionUrl,
      timeoutMs: deps.timeoutMs,
    });

    if (result.ok) {
      const body = { data: { items: result.items }, error: null, status: 200 } as const;
      res.status(200).json(body satisfies UploadList);
      return;
    }

    switch (result.kind) {
      case 'unauthenticated':
        res.status(401).json({ data: null, error: 'unauthenticated', status: 401 });
        return;
      case 'timeout':
        console.warn('[history] upstream timeout');
        res.status(504).json({ data: null, error: 'Upstream timeout', status: 504 });
        return;
      case 'bad-response':
        console.warn('[history] upstream bad response');
        res.status(502).json({ data: null, error: 'Bad upstream response', status: 502 });
        return;
      default:
        console.warn('[history] upstream error');
        res.status(502).json({ data: null, error: 'Upstream unavailable', status: 502 });
    }
  };
}
