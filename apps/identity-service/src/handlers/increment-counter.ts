import { Router, Request, Response } from 'express';
import { ZodError } from 'zod';
import { IncrementCounterParamsSchema } from '@proyecto/shared-types';
import { UploadCounterRepository } from '../service/upload-counter-repository';
import { currentYearMonth } from '../service/clock';

export interface IncrementCounterRouterDeps {
  counterRepo: UploadCounterRepository;
}

export function createIncrementCounterRouter({ counterRepo }: IncrementCounterRouterDeps): Router {
  const router = Router();

  router.post('/users/:userId/increment-counter', (req: Request, res: Response) => {
    const parsed = IncrementCounterParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(422).json({ data: null, error: formatZodError(parsed.error), status: 422 });
      return;
    }

    const { userId } = parsed.data;
    const yearMonth = currentYearMonth();

    try {
      const count = counterRepo.incrementForMonth(userId, yearMonth);
      res.status(200).json({ data: { count }, error: null, status: 200 });
    } catch (_err: unknown) {
      res.status(500).json({ data: null, error: 'internal server error', status: 500 });
    }
  });

  return router;
}

function formatZodError(err: ZodError): string {
  return err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
}
