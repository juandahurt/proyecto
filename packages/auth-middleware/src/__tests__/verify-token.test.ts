import jwt from 'jsonwebtoken';
import { verifyToken } from '../verify-token';

const TEST_SECRET = 'test-secret-for-verify-token-tests-at-least-32-chars';

beforeEach(() => {
  process.env.JWT_SECRET = TEST_SECRET;
});

afterEach(() => {
  delete process.env.JWT_SECRET;
});

describe('verifyToken', () => {
  it('round-trip HS256: firma y verifica preservando sub', () => {
    const payload = { sub: 'user-abc' };
    const token = jwt.sign(payload, TEST_SECRET, { algorithm: 'HS256', expiresIn: '7d' });
    const result = verifyToken(token);
    expect(result.sub).toBe('user-abc');
  });

  it('JWT_SECRET ausente lanza con mensaje literal', () => {
    delete process.env.JWT_SECRET;
    const token = jwt.sign({ sub: 'x' }, TEST_SECRET, { algorithm: 'HS256' });
    expect(() => verifyToken(token)).toThrow('JWT_SECRET missing from environment');
  });

  it('JWT_SECRET cadena vacía lanza con mensaje literal', () => {
    process.env.JWT_SECRET = '';
    const token = jwt.sign({ sub: 'x' }, TEST_SECRET, { algorithm: 'HS256' });
    expect(() => verifyToken(token)).toThrow('JWT_SECRET missing from environment');
  });

  it('algoritmo forzado HS256: token firmado con alg none no verifica', () => {
    // jsonwebtoken rechaza alg "none" cuando se fuerza algorithms:["HS256"]
    // Generamos un token sin firma usando la API no-secreta
    // En realidad jsonwebtoken no firma con "none" directamente,
    // pero si se pasa un token con header alg:none firmado a mano:
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ sub: 'attacker' })).toString('base64url');
    const noneToken = `${header}.${body}.`;
    expect(() => verifyToken(noneToken)).toThrow();
  });

  it('token con firma inválida lanza error', () => {
    const token = jwt.sign({ sub: 'user' }, TEST_SECRET, { algorithm: 'HS256' });
    // Manipulamos la firma
    const parts = token.split('.');
    parts[2] = parts[2].slice(0, -4) + 'XXXX';
    const tampered = parts.join('.');
    expect(() => verifyToken(tampered)).toThrow();
  });

  it('token expirado lanza error', () => {
    const token = jwt.sign({ sub: 'user' }, TEST_SECRET, {
      algorithm: 'HS256',
      expiresIn: -1,
    });
    expect(() => verifyToken(token)).toThrow();
  });
});
