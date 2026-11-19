export const TOKEN_KEY = 'estudio.token';

/** Decodifica el payload de un JWT sin verificar la firma. Devuelve null si no es legible. */
function decodePayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const parsed: unknown = JSON.parse(atob(padded));
    return parsed !== null && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Un token está expirado solo si su claim `exp` (segundos Unix) está en el pasado.
 * Sin `exp` o ilegible no se considera expirado: la última palabra la tiene el servidor.
 */
export function isExpired(token: string, nowMs: number = Date.now()): boolean {
  const payload = decodePayload(token);
  const exp = payload?.exp;
  return typeof exp === 'number' && exp * 1000 <= nowMs;
}

export function saveToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Almacenamiento no disponible (modo privado): la sesión no persiste, la app sigue.
  }
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Almacenamiento no disponible: nada que borrar.
  }
}

/** Lee el token guardado. Un token expirado se borra y se devuelve como ausente. */
export function readToken(): string | null {
  let token: string | null;
  try {
    token = window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
  if (!token) return null;
  if (isExpired(token)) {
    clearToken();
    return null;
  }
  return token;
}
