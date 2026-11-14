import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import '../express-augment';
import { requireAuth } from '../require-auth';

const TEST_SECRET = 'test-secret-for-require-auth-tests-at-least-32-chars';

/** Arma una mini app Express para las pruebas de integración del middleware. */
function makeApp() {
  const app = express();
  app.use(requireAuth);
  app.get('/me', (req, res) => {
    res.json({ userId: req.user?.userId });
  });
  return app;
}

beforeEach(() => {
  process.env.JWT_SECRET = TEST_SECRET;
});

afterEach(() => {
  delete process.env.JWT_SECRET;
});

describe('requireAuth', () => {
  it('no header Authorization → 401 unauthenticated', async () => {
    const app = makeApp();
    const res = await request(app).get('/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ data: null, error: 'unauthenticated', status: 401 });
  });

  it('malformed header (Basic ...) → 401 unauthenticated', async () => {
    const app = makeApp();
    const res = await request(app).get('/me').set('Authorization', 'Basic dXNlcjpwYXNz');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ data: null, error: 'unauthenticated', status: 401 });
  });

  it('wrong scheme (Token ...) → 401 unauthenticated', async () => {
    const app = makeApp();
    const res = await request(app).get('/me').set('Authorization', 'Token somevalue');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ data: null, error: 'unauthenticated', status: 401 });
  });

  it('tampered token (bad signature) → 401 unauthenticated', async () => {
    const app = makeApp();
    const token = jwt.sign({ sub: 'user-abc' }, TEST_SECRET, { algorithm: 'HS256' });
    const parts = token.split('.');
    parts[2] = parts[2].slice(0, -4) + 'XXXX';
    const tampered = parts.join('.');
    const res = await request(app).get('/me').set('Authorization', `Bearer ${tampered}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ data: null, error: 'unauthenticated', status: 401 });
  });

  it('expired token → 401 unauthenticated (TokenExpired)', async () => {
    const app = makeApp();
    const token = jwt.sign({ sub: 'user-abc' }, TEST_SECRET, {
      algorithm: 'HS256',
      expiresIn: -1,
    });
    const res = await request(app).get('/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ data: null, error: 'unauthenticated', status: 401 });
  });

  it('JWT_SECRET ausente → 500 server misconfiguration (no 401)', async () => {
    delete process.env.JWT_SECRET;
    const app = makeApp();
    // Usamos un token generado previamente con el secret
    const token = jwt.sign({ sub: 'user-abc' }, TEST_SECRET, { algorithm: 'HS256' });
    const res = await request(app).get('/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ data: null, error: 'server misconfiguration', status: 500 });
  });

  it('valid token → next() llamado, req.user.userId === "user-abc"', async () => {
    const app = makeApp();
    const token = jwt.sign({ sub: 'user-abc' }, TEST_SECRET, {
      algorithm: 'HS256',
      expiresIn: '7d',
    });
    const res = await request(app).get('/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: 'user-abc' });
  });
});
