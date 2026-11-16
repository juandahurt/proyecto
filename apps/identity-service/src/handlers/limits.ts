import { Router, Request, Response } from 'express';
import { requireAuth } from '@proyecto/auth-middleware';
import { UploadCounterRepository } from '../service/upload-counter-repository';
import { currentYearMonth, firstDayOfNextMonth } from '../service/clock';

const FREE_TIER_LIMIT = 10;

export interface LimitsRouterDeps {
  counterRepo: UploadCounterRepository;
}

export function createLimitsRouter({ counterRepo }: LimitsRouterDeps): Router {
  const router = Router();

  router.get('/me/limits', requireAuth, (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const yearMonth = currentYearMonth();
    const count = counterRepo.getForMonth(userId, yearMonth);
    const uploadsRemaining = Math.max(0, FREE_TIER_LIMIT - count);
    const resetDate = firstDayOfNextMonth();

    res.status(200).json({
      data: { tier: 'free', uploadsRemaining, uploadsLimit: FREE_TIER_LIMIT, resetDate },
      error: null,
      status: 200,
    });
  });

  return router;
}
