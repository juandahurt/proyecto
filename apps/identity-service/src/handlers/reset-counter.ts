import { Router, Request, Response } from 'express';
import { UploadCounterRepository } from '../service/upload-counter-repository';
import { currentYearMonth } from '../service/clock';

export interface ResetCounterRouterDeps {
  counterRepo: UploadCounterRepository;
}

/**
 * POST /api/internal/users/:userId/reset-counter — network-trusted, sin JWT
 * (mismo patrón que increment-counter). Pone a 0 el contador del mes en curso
 * únicamente (currentYearMonth()); no toca meses anteriores.
 *
 * Nota de diseño (ver bitácora): no existe en este repositorio un chequeo
 * reutilizable de existencia de usuario desde el contexto de este endpoint
 * (identity-service no expone esa consulta desde upload-counter-repository),
 * así que siempre responde 204 — operación idempotente sobre una fila que
 * puede o no existir (INSERT ... ON CONFLICT DO UPDATE SET count = 0).
 */
export function createResetCounterRouter({ counterRepo }: ResetCounterRouterDeps): Router {
  const router = Router();

  router.post('/users/:userId/reset-counter', (req: Request, res: Response) => {
    const { userId } = req.params;
    const yearMonth = currentYearMonth();

    try {
      counterRepo.resetForMonth(userId, yearMonth);
      res.status(204).end();
    } catch (_err: unknown) {
      res.status(500).json({ data: null, error: 'internal server error', status: 500 });
    }
  });

  return router;
}
