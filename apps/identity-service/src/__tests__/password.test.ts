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
});
