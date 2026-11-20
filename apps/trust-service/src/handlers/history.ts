import { Router, Request, Response } from 'express';
import { requireAuth } from '@proyecto/auth-middleware';
import { DeleteHistoryRequestSchema } from '@proyecto/shared-types';
import { FetchFn, deleteUserData } from '../service/ingestion-client';
import { resetCounter } from '../service/identity-client';

export interface HistoryRouterDeps {
  fetchFn: FetchFn;
  ingestionUrl: string;
  identityUrl: string;
  ingestionTimeoutMs: number;
  identityTimeoutMs: number;
}

/**
 * Crea el router de borrado de historial.
 *
 * DELETE /api/history (protegido por requireAuth):
 * - body { confirmation: 'DELETE' } (literal exacto) o 400, sin llamar a los
 *   endpoints internos.
 * - Cascada best-effort, en orden: (a) ingestion borra BD+blobs del usuario,
 *   (b) identity resetea el contador del mes en curso. El paso (b) se intenta
 *   aunque (a) haya fallado — el fallo de uno no cancela al otro.
 * - 204 si al menos un paso tuvo éxito; 500 solo si AMBOS fallaron.
 * - Ninguna llamada reenvía el Authorization del usuario (endpoints internos
 *   sin JWT).
 */
export function createHistoryRouter(deps: HistoryRouterDeps): Router {
  const router = Router();

  router.delete('/', requireAuth, async (req: Request, res: Response) => {
    const parsed = DeleteHistoryRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ data: null, error: 'invalid confirmation', status: 400 });
      return;
    }

    const userId = req.user!.userId;

    const ingestionResult = await deleteUserData({
      userId,
      fetchFn: deps.fetchFn,
      baseUrl: deps.ingestionUrl,
      timeoutMs: deps.ingestionTimeoutMs,
    });

    const identityResult = await resetCounter({
      userId,
      fetchFn: deps.fetchFn,
      baseUrl: deps.identityUrl,
      timeoutMs: deps.identityTimeoutMs,
    });

    if (!ingestionResult.ok && !identityResult.ok) {
      console.warn('[history] delete cascade failed: both steps failed');
      res.status(500).json({ data: null, error: 'internal server error', status: 500 });
      return;
    }

    if (!ingestionResult.ok || !identityResult.ok) {
      console.warn('[history] delete cascade partially failed: one step failed');
    }

    res.status(204).end();
  });

  return router;
}
