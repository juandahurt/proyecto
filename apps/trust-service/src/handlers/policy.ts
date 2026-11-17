import { Router, Request, Response } from 'express';
import { requireAuth } from '@proyecto/auth-middleware';

/**
 * Texto de política de datos de Estudio (placeholder; será refinado por el humano).
 *
 * Cumple AC-12.2:
 *   - Declara explícitamente que las imágenes nunca se usan para entrenar modelos
 *     sin consentimiento explícito y separado.
 *   - Indica cómo borrar el historial (referencia a Settings).
 */
const DEFAULT_POLICY_CONTENT = `Estudio stores the images you upload and the critique history generated for your content. This data is stored securely in our systems and is used solely to provide you with the critique service. We do not sell your data to third parties.

Your images and critique history are never used to train AI models without your explicit and separate consent. We will never share your data with third parties for training purposes without asking you first. You retain full ownership of all content you submit to Estudio.

You can permanently delete all your data at any time from Settings → Delete my history. Once deleted, your images and critique history are removed from our systems and cannot be recovered. For any questions about your data, contact us at privacy@estudio.app.`;

export interface PolicyRouterDeps {
  policyContent?: string;
}

/**
 * Crea el router de política de datos.
 *
 * GET / (registrado bajo /api/policy en server.ts)
 * Responde 200 { data: { content: string }, error: null, status: 200 }
 *
 * Requiere Authorization: Bearer <JWT> via requireAuth.
 *
 * @param deps.policyContent - Texto de política inyectable en tests.
 *   Si se omite, se usa DEFAULT_POLICY_CONTENT.
 */
export function createPolicyRouter(deps?: PolicyRouterDeps): Router {
  const router = Router();
  const policyContent = deps?.policyContent ?? DEFAULT_POLICY_CONTENT;

  /**
   * GET /api/policy
   * Responde 200 { data: { content: <texto> }, error: null, status: 200 }
   */
  router.get('/', requireAuth, (_req: Request, res: Response) => {
    res.status(200).json({
      data: { content: policyContent },
      error: null,
      status: 200,
    });
  });

  return router;
}
