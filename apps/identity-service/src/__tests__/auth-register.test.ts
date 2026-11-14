/**
 * Tests de integración para POST /api/auth/register.
 * Supertest sobre createApp() — sin I/O de red real.
 *
 * ROJO PRIMERO: este archivo se escribe antes de que exista el handler.
 * Se espera ver fallos (404) hasta que el handler esté implementado.
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

describe('POST /api/auth/register', () => {
  function makeApp() {
    const db = createDatabase(':memory:');
    const repo = createUserRepository(db);
    return { app: createApp({ db, repo }), db, repo };
  }

  it('CA-8 — 201 con token y expiresIn=604800 para payload válido', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'alice@example.com', password: 'hunter2hunter2' });

    expect(res.status).toBe(201);
    expect(res.body.error).toBeNull();
    expect(res.body.status).toBe(201);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.expiresIn).toBe(604800);
  });

  it('CA-8 — verify(token).sub === findByEmail(email).id', async () => {
    const { app, repo } = makeApp();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'bob@example.com', password: 'password123' });

    const token = res.body.data.token;
    const payload = verify(token);
    const user = repo.findByEmail('bob@example.com');
    expect(payload.sub).toBe(user?.id);
  });

  it('CA-9 — 409 cuando el email ya existe', async () => {
    const { app } = makeApp();
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@example.com', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@example.com', password: 'password123' });

    expect(res.status).toBe(409);
    expect(res.body.data).toBeNull();
    expect(typeof res.body.error).toBe('string');
    expect(res.body.status).toBe(409);
  });

  it('CA-9 — conteo en BD sigue siendo 1 tras intento duplicado', async () => {
    const { app, db } = makeApp();
    const email = 'count@example.com';
    await request(app).post('/api/auth/register').send({ email, password: 'password123' });
    await request(app).post('/api/auth/register').send({ email, password: 'password123' });

    const row = db.prepare('SELECT COUNT(*) as cnt FROM users WHERE email = ?').get(email) as {
      cnt: number;
    };
    expect(row.cnt).toBe(1);
  });

  it('CA-10 — 422 con password corto (menos de 8 chars)', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'short@example.com', password: '1234567' });

    expect(res.status).toBe(422);
    expect(res.body.data).toBeNull();
    expect(typeof res.body.error).toBe('string');
    expect(res.body.status).toBe(422);
  });

  it('CA-10 — 422 con email de formato inválido', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'validpassword' });

    expect(res.status).toBe(422);
    expect(res.body.data).toBeNull();
    expect(typeof res.body.error).toBe('string');
    expect(res.body.status).toBe(422);
  });

  it('500 cuando el repositorio lanza un error inesperado', async () => {
    const db = createDatabase(':memory:');
    const repo = createUserRepository(db);
    // Sobrescribir create para lanzar un error inesperado (no UNIQUE)
    const faultyRepo = {
      ...repo,
      create: () => {
        const err = new Error('disk full');
        (err as unknown as Record<string, unknown>).code = 'SQLITE_FULL';
        throw err;
      },
    };
    const app = createApp({ db, repo: faultyRepo });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'err@example.com', password: 'password123' });

    expect(res.status).toBe(500);
    expect(res.body.data).toBeNull();
    expect(res.body.status).toBe(500);
  });
});
