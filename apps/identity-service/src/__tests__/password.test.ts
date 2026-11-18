/**
 * Tests unitarios para el módulo de hashing de contraseñas.
 * CA-6: bcrypt con cost >= 10, round-trip hash/compare.
 */
import { hash, compare } from '../service/password';

describe('password helpers', () => {
  it('CA-6 — hash no es igual al plaintext', async () => {
    const h = await hash('hunter2hunter2');
    expect(h).not.toBe('hunter2hunter2');
  });

  it('CA-6 — hash empieza por prefijo bcrypt y cost >= 10', async () => {
    const h = await hash('hunter2hunter2');
    expect(h).toMatch(/^\$2[ab]\$\d{2}\$/);
    const cost = parseInt(h.match(/^\$2[ab]\$(\d{2})\$/)![1], 10);
    expect(cost).toBeGreaterThanOrEqual(10);
  });

  it('CA-6 — compare devuelve true para contraseña correcta', async () => {
    const h = await hash('mypassword');
    const result = await compare('mypassword', h);
    expect(result).toBe(true);
  });

  it('CA-6 — compare devuelve false para contraseña incorrecta', async () => {
    const h = await hash('mypassword');
    const result = await compare('wrongpassword', h);
    expect(result).toBe(false);
  });

  // COMPAT (u8-T03): hash generado con bcrypt 5.1.1 (versión previa a la 6.x) con una
  // contraseña falsa; garantiza que los usuarios ya registrados siguen pudiendo entrar.
  const HASH_BCRYPT_5 = '$2b$10$iAegri6ypPHw/s1WC2hYEOIVhGcLhLcN/EHD6sQN.pFIEUl6VLGP2';

  it('COMPAT — hash de bcrypt 5 se verifica con la versión actual', async () => {
    expect(await compare('clave-solo-para-tests', HASH_BCRYPT_5)).toBe(true);
  });

  it('COMPAT — contraseña distinta contra hash de bcrypt 5 devuelve false', async () => {
    expect(await compare('otra-clave-distinta', HASH_BCRYPT_5)).toBe(false);
  });
});
