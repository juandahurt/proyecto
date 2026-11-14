/**
 * Tests de integración para POST /api/auth/login.
 * Supertest sobre createApp() — sin I/O de red real.
 */
import request from 'supertest';
import { createApp } from '../server';
import { createDatabase } from '../service/database';
import { createUserRepository } from '../service/user-repository';
import { verify } from '../service/jwt';

// Secret de prueba — nunca productivo.
const TEST_SECRET = 'a-test-secret-for-tests-only-32bytes!';

beforeAll(() => {
  process.env.JWT_SECRET = TEST_SECRET;
});

afterAll(() => {
  delete process.env.JWT_SECRET;
});

describe('POST /api/auth/login', () => {
  function makeApp() {
    const db = createDatabase(':memory:');
    const repo = createUserRepository(db);
    return { app: createApp({ db, repo }), db, repo };
  }

  async function registerUser(app: ReturnType<typeof createApp>, email: string, password: string) {
    const res = await request(app).post('/api/auth/register').send({ email, password });
    return res.body.data;
  }

  it('CA-11 — login ok 200 con token y expiresIn=604800 para credenciales válidas', async () => {
    const { app } = makeApp();
    await registerUser(app, 'carol@example.com', 'secretpass123');

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'carol@example.com', password: 'secretpass123' });

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.expiresIn).toBe(604800);
  });

  it('CA-11 — verify(token).sub === user.id del usuario registrado', async () => {
    const { app, repo } = makeApp();
    await registerUser(app, 'dave@example.com', 'secretpass123');

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'dave@example.com', password: 'secretpass123' });

    const payload = verify(res.body.data.token);
    const user = repo.findByEmail('dave@example.com');
    expect(payload.sub).toBe(user?.id);
  });

  it('CA-12 — 401 con mensaje "invalid credentials" para password incorrecto', async () => {
    const { app } = makeApp();
    await registerUser(app, 'eve@example.com', 'correctpass123');

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'eve@example.com', password: 'wrongpassword1' });

    expect(res.status).toBe(401);
    expect(res.body.data).toBeNull();
    expect(res.body.error).toBe('invalid credentials');
    expect(res.body.status).toBe(401);
  });

  it('CA-13 — 401 login nonexistent email unknown email: "invalid credentials"', async () => {
    const { app } = makeApp();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.data).toBeNull();
    expect(res.body.error).toBe('invalid credentials');
    expect(res.body.status).toBe(401);
  });
});
