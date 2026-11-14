/**
 * Tests unitarios para el módulo JWT.
 * CA-7: sign/verify round-trip, TTL ~7 días, tampered token lanza, JWT_SECRET ausente lanza.
 */
import { sign, verify } from '../service/jwt';

const TEST_SECRET = 'a-test-secret-for-ca7-only-32bytes!';

beforeAll(() => {
  process.env.JWT_SECRET = TEST_SECRET;
});

afterAll(() => {
  delete process.env.JWT_SECRET;
});

describe('jwt helpers', () => {
  it('CA-7 — round-trip: verify(sign({sub})).sub === sub', () => {
    const token = sign({ sub: 'user-123' });
    const payload = verify(token);
    expect(payload.sub).toBe('user-123');
  });

  it('CA-7 — TTL ~7 días (604800s, tolerancia ±60s)', () => {
    const token = sign({ sub: 'user-ttl' });
    const payload = verify(token);
    const delta = payload.exp! - Math.floor(Date.now() / 1000);
    expect(delta).toBeGreaterThanOrEqual(604800 - 60);
    expect(delta).toBeLessThanOrEqual(604800 + 60);
  });

  it('CA-7 — token manipulado lanza', () => {
    const token = sign({ sub: 'user-tamper' });
    expect(() => verify(token + 'tampered')).toThrow();
  });

  it('CA-7 — sign lanza cuando JWT_SECRET está ausente', () => {
    const saved = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    expect(() => sign({ sub: 'x' })).toThrow();
    process.env.JWT_SECRET = saved;
  });

  it('CA-7 — verify lanza cuando JWT_SECRET está ausente', () => {
    const token = sign({ sub: 'user-secret-check' });
    const saved = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    expect(() => verify(token)).toThrow();
    process.env.JWT_SECRET = saved;
  });
});
