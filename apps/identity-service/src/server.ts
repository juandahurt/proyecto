import express, { Application, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { healthHandler } from './handlers/health';
import { createAuthRouter } from './handlers/auth';
import { createLimitsRouter } from './handlers/limits';
import { createIncrementCounterRouter } from './handlers/increment-counter';
import { createDatabase } from './service/database';
import { createUserRepository, UserRepository } from './service/user-repository';
import {
  createUploadCounterRepository,
  UploadCounterRepository,
} from './service/upload-counter-repository';

export interface AppDeps {
  db?: Database.Database;
  repo?: UserRepository;
  counterRepo?: UploadCounterRepository;
}

/**
 * Crea la aplicacion Express con todas las rutas registradas.
 */
export function createApp(deps?: AppDeps): Application {
  const app = express();
  app.use(express.json());
  app.get('/health', healthHandler);

  const db = deps?.db ?? createDatabase();
  const repo = deps?.repo ?? createUserRepository(db);
  const counterRepo = deps?.counterRepo ?? createUploadCounterRepository(db);

  app.use('/api/auth', createAuthRouter({ repo }));
  app.use('/api/users', createLimitsRouter({ counterRepo }));
  app.use('/api/internal', createIncrementCounterRouter({ counterRepo }));

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ data: null, error: 'Not Found', status: 404 });
  });

  return app;
}
