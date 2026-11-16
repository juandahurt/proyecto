import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../server';
import { createDatabase } from '../service/database';
import { createUserRepository } from '../service/user-repository';
import { createUploadCounterRepository } from '../service/upload-counter-repository';

const TEST_SECRET = 'a-test-secret-for-tests-only';

function makeJwt(userId: string): string {
  return jwt.sign({ sub: userId }, TEST_SECRET, { algorithm: 'HS256', expiresIn: '7d' });
}

function makeApp() {
  const db = createDatabase(':memory:');
  const repo = createUserRepository(db);
  const counterRepo = createUploadCounterRepository(db);
  return { app: createApp({ db, repo, counterRepo }), db, counterRepo };
}

beforeAll(() => {
  process.env.JWT_SECRET = TEST_SECRET;
});
afterAll(() => {
  delete process.env.JWT_SECRET;
});

describe('GET /api/users/me/limits', () => {
  it('CA-6: responde 401 con error "unauthenticated" cuando no hay header Authorization', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/users/me/limits');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ data: null, error: 'unauthenticated', status: 401 });
  });

  it('CA-6: responde 401 cuando Authorization no empieza con Bearer', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/users/me/limits').set('Authorization', 'Basic xxx');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthenticated');
  });

  it('CA-7: responde 200 fresh (uploadsRemaining=10) para usuario sin uploads', async () => {
    const { app } = makeApp();
    const userId = 'a0eebc99-9c0b-4ef8-bb6d-111111111111';
    const token = makeJwt(userId);
    const res = await request(app)
      .get('/api/users/me/limits')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      data: { tier: 'free', uploadsRemaining: 10, uploadsLimit: 10 },
      error: null,
      status: 200,
    });
    expect(res.body.data.resetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('CA-8: con count=3 devuelve uploadsRemaining=7', async () => {
    const { app, counterRepo } = makeApp();
    const userId = 'a0eebc99-9c0b-4ef8-bb6d-222222222222';
    const token = makeJwt(userId);
    const { currentYearMonth } = await import('../service/clock');
    const ym = currentYearMonth();
    counterRepo.incrementForMonth(userId, ym);
    counterRepo.incrementForMonth(userId, ym);
    counterRepo.incrementForMonth(userId, ym);
    const res = await request(app)
      .get('/api/users/me/limits')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.data.uploadsRemaining).toBe(7);
    expect(res.body.data.uploadsLimit).toBe(10);
  });

  it('CA-8: con count=10 devuelve uploadsRemaining=0', async () => {
    const { app, counterRepo } = makeApp();
    const userId = 'a0eebc99-9c0b-4ef8-bb6d-333333333333';
    const token = makeJwt(userId);
    const { currentYearMonth } = await import('../service/clock');
    const ym = currentYearMonth();
    for (let i = 0; i < 10; i++) counterRepo.incrementForMonth(userId, ym);
    const res = await request(app)
      .get('/api/users/me/limits')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.data.uploadsRemaining).toBe(0);
  });

  it('CA-8: con count=15 (defensivo) devuelve uploadsRemaining=0, nunca negativo (clamp)', async () => {
    const { app, counterRepo } = makeApp();
    const userId = 'a0eebc99-9c0b-4ef8-bb6d-444444444444';
    const token = makeJwt(userId);
    const { currentYearMonth } = await import('../service/clock');
    const ym = currentYearMonth();
    for (let i = 0; i < 15; i++) counterRepo.incrementForMonth(userId, ym);
    const res = await request(app)
      .get('/api/users/me/limits')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.data.uploadsRemaining).toBe(0);
    expect(res.body.data.uploadsRemaining).toBeGreaterThanOrEqual(0);
  });
});
