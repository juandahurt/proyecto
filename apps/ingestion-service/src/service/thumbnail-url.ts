import crypto from 'crypto';

/** Vida de una URL firmada de miniatura (contrato C1: 15 minutos). No configurable. */
export const THUMBNAIL_TTL_SECONDS = 900;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIG_RE = /^[0-9a-f]{64}$/i;
const EXP_RE = /^[0-9]+$/;

/** HMAC-SHA256 (hex) de `thumbnail:<uploadId>:<exp>`: el prefijo separa el dominio de la firma. */
function computeSignature(uploadId: string, exp: number | string, key: string): string {
  return crypto.createHmac('sha256', key).update(`thumbnail:${uploadId}:${exp}`).digest('hex');
}

/**
 * Emite una ruta relativa firmada: /api/uploads/<uploadId>/thumbnail?exp=<unix s>&sig=<hex>.
 * La firma no ata al usuario: la autorización se decide al emitir la URL.
 */
export function signThumbnailUrl(args: { uploadId: string; key: string; nowMs: number }): string {
  const exp = Math.floor(args.nowMs / 1000) + THUMBNAIL_TTL_SECONDS;
  const sig = computeSignature(args.uploadId, exp, args.key);
  return `/api/uploads/${args.uploadId}/thumbnail?exp=${exp}&sig=${sig}`;
}

/**
 * Verifica la firma. Devuelve false (nunca lanza) ante cualquier entrada inválida, firma incorrecta
 * o URL expirada (en el segundo `exp` ya no vale).
 */
export function verifyThumbnailSignature(args: {
  uploadId: string;
  exp: string;
  sig: string;
  key: string;
  nowMs: number;
}): boolean {
  try {
    const { uploadId, exp, sig, key, nowMs } = args;
    if (typeof uploadId !== 'string' || !UUID_RE.test(uploadId)) return false;
    if (typeof exp !== 'string' || !EXP_RE.test(exp)) return false;
    if (typeof sig !== 'string' || !SIG_RE.test(sig)) return false;
    const expNum = Number(exp);
    if (!Number.isSafeInteger(expNum) || expNum <= 0) return false;

    const given = Buffer.from(sig.toLowerCase(), 'hex');
    const expected = Buffer.from(computeSignature(uploadId, exp, key), 'hex');
    // timingSafeEqual lanza si las longitudes difieren; ambas son 32 bytes tras SIG_RE
    if (given.length !== expected.length) return false;
    if (!crypto.timingSafeEqual(given, expected)) return false;

    return Math.floor(nowMs / 1000) < expNum;
  } catch {
    return false;
  }
}
