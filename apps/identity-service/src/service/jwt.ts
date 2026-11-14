import jwt from 'jsonwebtoken';
import { JwtPayload } from '@proyecto/shared-types';

/** TTL del token en segundos: 7 días. */
const TOKEN_TTL_SECONDS = 604800;

/**
 * Firma un payload JWT con HS256.
 *
 * @param payload - Datos a firmar. Debe incluir `sub` (UUID del usuario).
 * @returns JWT firmado como string.
 * @throws Error si JWT_SECRET no está configurado en el entorno.
 */
export function sign(payload: JwtPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set in environment');
  }
  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn: TOKEN_TTL_SECONDS,
  });
}

/**
 * Verifica y decodifica un JWT.
 *
 * @param token - JWT a verificar.
 * @returns Payload decodificado.
 * @throws Error si el token es inválido, expirado, o la firma no coincide.
 */
export function verify(token: string): JwtPayload & { iat: number; exp: number } {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set in environment');
  }
  const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
  return {
    sub: decoded.sub as string,
    iat: decoded.iat as number,
    exp: decoded.exp as number,
  };
}
