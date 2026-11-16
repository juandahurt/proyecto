import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../server';
import { createDatabase } from '../service/database';
import { createUserRepository } from '../service/user-repository';
import { createUploadCounterRepository } from '../service/upload-counter-repository';
import { createSubscriptionRepository } from '../service/subscription-repository';

const TEST_SECRET = 'a-test-secret-for-tests-only';

function makeJwt(userId: string): string {
  return jwt.sign({ sub: userId }, TEST_SECRET, { algorithm: 'HS256', expiresIn: '7d' });
}

function makeApp() {
  const db = createDatabase(':memory:');
  const repo = createUserRepository(db);
  const counterRepo = createUploadCounterRepository(db);
  const subscriptionRepo = createSubscriptionRepository(db);
  return {
    app: createApp({ db, repo, counterRepo, subscriptionRepo }),
    db,
    counterRepo,
    subscriptionRepo,
  };
}

beforeAll(() => {
  process.env.JWT_SECRET = TEST_SECRET;
});
afterAll(() => {
  delete process.env.JWT_SECRET;
});

describe('POST /api/users/me/subscribe', () => {
  it('CA-4: 401 sin header Authorization', async () => {
    const { app } = makeApp();
    const res = await request(app).post('/api/users/me/subscribe');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ data: null, error: 'unauthenticated', status: 401 });
  });

  it('CA-4: 401 cuando Authorization no empieza con Bearer', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/api/users/me/subscribe')
      .set('Authorization', 'Basic xxx');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthenticated');
  });

  it('CA-5: 200 upgrade — devuelve tier:"paid" y campos null', async () => {
    const { app } = makeApp();
    const userId = 'a0eebc99-9c0b-4ef8-bb6d-100000000001';
    const token = makeJwt(userId);
    const res = await request(app)
      .post('/api/users/me/subscribe')
      .set('Authorization', 'Bearer ' + token)
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      data: {
        tier: 'paid',
        uploadsRemaining: null,
        uploadsLimit: null,
        resetDate: null,
      },
      error: null,
      status: 200,
    });
  });

  it('CA-5: upgradesTo paid — SELECT tier FROM subscriptions confirma "paid"', async () => {
    const { app, db } = makeApp();
    const userId = 'a0eebc99-9c0b-4ef8-bb6d-100000000002';
    const token = makeJwt(userId);
    await request(app)
      .post('/api/users/me/subscribe')
      .set('Authorization', 'Bearer ' + token)
      .set('Content-Type', 'application/json');
    const row = db.prepare('SELECT tier FROM subscriptions WHERE user_id = ?').get(userId) as
      { tier: string } | undefined;
    expect(row?.tier).toBe('paid');
  });

  it('CA-6: after subscribe — GET /api/users/me/limits devuelve tier:"paid"', async () => {
    const { app } = makeApp();
    const userId = 'a0eebc99-9c0b-4ef8-bb6d-100000000003';
    const token = makeJwt(userId);
    // after subscribe
    await request(app)
      .post('/api/users/me/subscribe')
      .set('Authorization', 'Bearer ' + token)
      .set('Content-Type', 'application/json');
    // limits after upgrade
    const limitsRes = await request(app)
      .get('/api/users/me/limits')
      .set('Authorization', 'Bearer ' + token);
    expect(limitsRes.status).toBe(200);
    expect(limitsRes.body).toMatchObject({
      data: {
        tier: 'paid',
        uploadsRemaining: null,
        uploadsLimit: null,
        resetDate: null,
      },
      error: null,
      status: 200,
    });
  });

  it('CA-7: idempotent — segundo POST /api/users/me/subscribe devuelve 200 con tier:"paid"', async () => {
    const { app } = makeApp();
    const userId = 'a0eebc99-9c0b-4ef8-bb6d-100000000004';
    const token = makeJwt(userId);

    const first = await request(app)
      .post('/api/users/me/subscribe')
      .set('Authorization', 'Bearer ' + token)
      .set('Content-Type', 'application/json');
    expect(first.status).toBe(200);
    expect(first.body.data.tier).toBe('paid');

    // second call — should not fail (twice / second subscribe)
    const second = await request(app)
      .post('/api/users/me/subscribe')
      .set('Authorization', 'Bearer ' + token)
      .set('Content-Type', 'application/json');
    expect(second.status).toBe(200);
    expect(second.body.data.tier).toBe('paid');
  });

  it('CA-7: idempotent 200 twice — after two calls limits still returns paid', async () => {
    const { app } = makeApp();
    const userId = 'a0eebc99-9c0b-4ef8-bb6d-100000000005';
    const token = makeJwt(userId);

    await request(app)
      .post('/api/users/me/subscribe')
      .set('Authorization', 'Bearer ' + token)
      .set('Content-Type', 'application/json');
    await request(app)
      .post('/api/users/me/subscribe')
      .set('Authorization', 'Bearer ' + token)
      .set('Content-Type', 'application/json');

    const limitsRes = await request(app)
      .get('/api/users/me/limits')
      .set('Authorization', 'Bearer ' + token);
    expect(limitsRes.status).toBe(200);
    expect(limitsRes.body.data.tier).toBe('paid');
  });
});
