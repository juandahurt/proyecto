import { Request, Response, NextFunction, RequestHandler } from 'express';
import { verifyToken } from './verify-token';

/** Body de respuesta 401 uniforme para todos los caminos de fallo de autenticación. */
const UNAUTHENTICATED_BODY = {
  data: null,
  error: 'unauthenticated',
  status: 401,
} as const;

/** Body de respuesta 500 para error de configuración de servidor. */
const MISCONFIGURATION_BODY = {
  data: null,
  error: 'server misconfiguration',
  status: 500,
} as const;

/**
 * Middleware Express que valida el JWT del header `Authorization: Bearer <token>`.
 *
 * - Éxito: setea `req.user = { userId: payload.sub }` y llama `next()`.
 * - Fallo de autenticación (header ausente, malformado, token inválido,
 *   expirado, firma incorrecta): responde 401 con `{data:null, error:"unauthenticated", status:401}`.
 * - Fallo de configuración (`JWT_SECRET` ausente): responde 500 con
 *   `{data:null, error:"server misconfiguration", status:500}`.
 *   Esta distinción es intencional: en un dashboard de alertas,
 *   401 == "token del cliente malo"; 500 == "deployment mal configurado".
 */
export const requireAuth: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  // 1. Verificar presencia y formato "Bearer <token>"
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json(UNAUTHENTICATED_BODY);
    return;
  }

  const token = authHeader.slice('Bearer '.length);

  // 2. Verificar que JWT_SECRET esté configurado (error de servidor, no de cliente)
  if (!process.env.JWT_SECRET) {
    res.status(500).json(MISCONFIGURATION_BODY);
    return;
  }

  // 3. Verificar y decodificar el token
  try {
    const payload = verifyToken(token);
    req.user = { userId: payload.sub };
    next();
  } catch (err: unknown) {
    // JWT_SECRET ausente → ya se detectó arriba; aquí sólo llegan errores JWT
    if (err instanceof Error && err.message === 'JWT_SECRET missing from environment') {
      res.status(500).json(MISCONFIGURATION_BODY);
      return;
    }
    // Token inválido (firma bad, expirado, malformado)
    res.status(401).json(UNAUTHENTICATED_BODY);
  }
};
