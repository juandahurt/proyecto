import { Router, Request, Response } from 'express';
import { ZodError } from 'zod';
import { CritiqueRequestSchema } from '@proyecto/shared-types';
import { AnthropicClient } from '../service/anthropic-client';
import { AnthropicIntegrationError } from '../service/anthropic-error';
import { CritiqueRepository } from '../service/critique-repository';

export interface CritiquesRouterDeps {
  client: AnthropicClient;
  repo: CritiqueRepository;
}

/**
 * Crea el router de /critiques con las dependencias inyectadas.
 *
 * El handler no construye el cliente ni el repositorio internamente;
 * los recibe por parametro. Esto permite a los tests inyectar un
 * AnthropicClient con scenario: "error" sin tocar globales ni singletons.
 *
 * @param deps - Dependencias: { client: AnthropicClient; repo: CritiqueRepository }
 * @returns Router de Express con POST /critiques registrado.
 */
export function createCritiquesRouter(deps: CritiquesRouterDeps): Router {
  const router = Router();
  const { client, repo } = deps;

  /**
   * POST /critiques
   *
   * Body: { input: string (min 1, max 5000) }
   *
   * Respuestas:
   *   200: { data: { id, response }, error: null, status: 200 }
   *   400: { data: null, error: string, status: 400 }  — input invalido (ZodError)
   *   502: { data: null, error: "anthropic integration error", status: 502 }  — fallo en Anthropic
   *   500: { data: null, error: "internal server error", status: 500 }  — error inesperado
   */
  router.post('/', async (req: Request, res: Response) => {
    // 1. Validar el body con Zod (CritiqueRequestSchema)
    let input: string;
    try {
      const parsed = CritiqueRequestSchema.parse(req.body ?? {});
      input = parsed.input;
    } catch (err) {
      if (err instanceof ZodError) {
        const zodErr = err as ZodError;
        const message = zodErr.issues.map((e) => e.message).join('; ');
        res.status(400).json({ data: null, error: message, status: 400 });
        return;
      }
      res.status(400).json({ data: null, error: 'invalid request body', status: 400 });
      return;
    }

    // 2. Invocar el cliente de Anthropic
    let response;
    try {
      response = await client.critique(input);
    } catch (err) {
      if (err instanceof AnthropicIntegrationError) {
        res.status(502).json({ data: null, error: 'anthropic integration error', status: 502 });
        return;
      }
      res.status(500).json({ data: null, error: 'internal server error', status: 500 });
      return;
    }

    // 3. Persistir en la BD
    let id: number;
    try {
      const saved = repo.save(input, response);
      id = saved.id;
    } catch {
      res.status(500).json({ data: null, error: 'internal server error', status: 500 });
      return;
    }

    // 4. Responder con el id y la respuesta
    res.status(200).json({ data: { id, response }, error: null, status: 200 });
  });

  return router;
}
