import express, { Application, Request, Response } from 'express';
import { healthHandler } from './handlers/health';

export function createApp(): Application {
  const app = express();

  app.use(express.json());

  app.get('/health', healthHandler);

  // Fallback 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      data: null,
      error: 'Not Found',
      status: 404,
    });
  });

  return app;
}
