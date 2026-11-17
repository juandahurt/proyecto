import { Router, Request, Response } from 'express';
import { requireAuth } from '@proyecto/auth-middleware';
import { UploadCounterRepository } from '../service/upload-counter-repository';
import { SubscriptionRepository } from '../service/subscription-repository';

export interface SubscribeRouterDeps {
  counterRepo: UploadCounterRepository;
  subscriptionRepo: SubscriptionRepository;
}

export function createSubscribeRouter({ subscriptionRepo }: SubscribeRouterDeps): Router {
  const router = Router();

  router.post('/me/subscribe', requireAuth, (req: Request, res: Response) => {
    const userId = req.user!.userId;
    subscriptionRepo.upgradeToPaid(userId);

    res.status(200).json({
      data: {
        tier: 'paid',
        uploadsRemaining: null,
        uploadsLimit: null,
        resetDate: null,
      },
      error: null,
      status: 200,
    });
  });

  return router;
}
