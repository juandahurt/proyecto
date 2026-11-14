/**
 * Barrel del package @proyecto/auth-middleware.
 *
 * Re-exporta requireAuth, verifyToken y la augmentación de tipos Express
 * (como side-effect) para que los consumidores obtengan req.user tipado
 * automáticamente al importar desde este package.
 */

// Side-effect: registra la augmentación de tipos Express.Request.user
import './express-augment';

export { requireAuth } from './require-auth';
export { verifyToken } from './verify-token';
