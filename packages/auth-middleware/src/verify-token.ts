import jwt from 'jsonwebtoken';
import { JwtPayload, JwtPayloadSchema } from '@proyecto/shared-types';

/**
 * Verifica y decodifica un JWT.
 *
 * Lee `process.env.JWT_SECRET` y lanza si es ausente o cadena vacía.
 * Fuerza el algoritmo HS256 — no acepta `alg: "none"`.
 *
 * @param token - JWT a verificar (string crudo sin prefijo "Bearer ").
 * @returns Payload tipado como JwtPayload importado de @proyecto/shared-types.
 * @throws Error('JWT_SECRET missing from environment') si el secret falta.
 * @throws Error de jsonwebtoken si el token es inválido, expirado o manipulado.
 */
export function verifyToken(token: string): JwtPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET missing from environment');
  }

  const decoded = jwt.verify(token, secret, {
    algorithms: ['HS256'],
  }) as jwt.JwtPayload;

  return JwtPayloadSchema.parse({
    sub: decoded.sub,
    iat: decoded.iat,
    exp: decoded.exp,
  });
}
