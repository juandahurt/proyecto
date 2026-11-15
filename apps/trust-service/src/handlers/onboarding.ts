import { Router, Request, Response } from 'express';
import { ZodError } from 'zod';
import { OnboardingAckRequestSchema } from '@proyecto/shared-types';
import { requireAuth } from '@proyecto/auth-middleware';
import { OnboardingRepository } from '../service/onboarding-repository';

export interface OnboardingRouterDeps {
  repo: OnboardingRepository;
}

/**
 * Crea el router de onboarding.
 *
 * GET  /api/onboarding — retorna si el usuario completó el onboarding.
 * POST /api/onboarding — registra el acknowledgment con los 3 checkboxes en true.
 *
 * Ambos endpoints exigen `Authorization: Bearer <JWT>` via requireAuth.
 *
 * Decisión de status en POST: se usa 200 (no 204) para mantener el shape
 * uniforme {data, error, status} que team.md manda. Ver nota en la tarea.
 */
export function createOnboardingRouter({ repo }: OnboardingRouterDeps): Router {
  const router = Router();

  /**
   * GET /api/onboarding
   * Responde 200 { data: { completed: boolean }, error: null, status: 200 }
   */
  router.get('/', requireAuth, (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const completed = repo.hasAck(userId);
    res.status(200).json({
      data: { completed },
      error: null,
      status: 200,
    });
  });

  /**
   * POST /api/onboarding
   * Body: { checkbox1: true, checkbox2: true, checkbox3: true }
   * Éxito: 200 { data: { acknowledged: true }, error: null, status: 200 }
   * Fallo de validación: 422 { data: null, error: string, status: 422 }
   */
  router.post('/', requireAuth, (req: Request, res: Response) => {
    const parsed = OnboardingAckRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({
        data: null,
        error: formatZodError(parsed.error),
        status: 422,
      });
      return;
    }

    const userId = req.user!.userId;
    repo.recordAck(userId);

    res.status(200).json({
      data: { acknowledged: true },
      error: null,
      status: 200,
    });
  });

  return router;
}

/** Formatea un ZodError en un string legible sin filtrar el stack. */
function formatZodError(err: ZodError): string {
  return err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
}
