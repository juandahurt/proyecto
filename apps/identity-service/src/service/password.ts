import bcrypt from 'bcrypt';

/** Cost factor para bcrypt. Mínimo 10 (según especificación). */
const BCRYPT_ROUNDS = 10;

/**
 * Genera el hash bcrypt de una contraseña en texto plano.
 *
 * @param plain - Contraseña en texto plano.
 * @returns Hash bcrypt con prefijo $2b$ y cost BCRYPT_ROUNDS.
 */
export async function hash(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Compara una contraseña en texto plano con un hash bcrypt.
 *
 * @param plain - Contraseña en texto plano a verificar.
 * @param hashed - Hash bcrypt almacenado.
 * @returns true si coinciden, false en caso contrario.
 */
export async function compare(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}
