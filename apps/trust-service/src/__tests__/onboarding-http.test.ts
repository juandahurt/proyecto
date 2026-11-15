import request from 'supertest';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { createApp } from '../server';
import { createDatabase } from '../service/database';
import { createOnboardingRepository } from '../service/onboarding-repository';

const TEST_SECRET = 'a-test-secret-for-tests-only';

function makeJwt(userId: string): string {
  return jwt.sign({ sub: userId }, TEST_SECRET, { algorithm: 'HS256', expiresIn: '7d' });
}

describe('Onboarding HTTP handlers', () => {
  let db: Database.Database;
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    process.env.JWT_SECRET = TEST_SECRET;
  });

  beforeEach(() => {
    db = createDatabase(':memory:');
    const repo = createOnboardingRepository(db);
    app = createApp({ db, repo });
  });

  afterEach(() => {
    db.close();
  });

  // ---------------------------------------------------------------------------
  // CA-5: 401 sin Authorization header
  // ---------------------------------------------------------------------------

  it('GET /api/onboarding: 401 unauthenticated — no auth header', async () => {
    const res = await request(app).get('/api/onboarding');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ data: null, error: 'unauthenticated', status: 401 });
  });

  it('POST /api/onboarding: 401 unauthenticated — no auth header', async () => {
    const res = await request(app)
      .post('/api/onboarding')
      .send({ checkbox1: true, checkbox2: true, checkbox3: true });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ data: null, error: 'unauthenticated', status: 401 });
  });

  // ---------------------------------------------------------------------------
  // CA-6: GET 200 fresh user (no ack)
  // ---------------------------------------------------------------------------

  it('GET /api/onboarding: 200 completed=false for fresh user (not acked)', async () => {
    const token = makeJwt('fresh-user-001');
    const res = await request(app).get('/api/onboarding').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { completed: false }, error: null, status: 200 });
  });

  // ---------------------------------------------------------------------------
  // CA-7: GET 200 completed=true after ack
  // ---------------------------------------------------------------------------

  it('GET /api/onboarding: 200 completed=true for already acknowledged user', async () => {
    const userId = 'acked-user-001';
    const repo = createOnboardingRepository(db);
    repo.recordAck(userId);
    app = createApp({ db, repo });

    const token = makeJwt(userId);
    const res = await request(app).get('/api/onboarding').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { completed: true }, error: null, status: 200 });
  });

  // ---------------------------------------------------------------------------
  // CA-8: POST happy path with three true checkboxes — acknowledged:true
  // ---------------------------------------------------------------------------

  it('POST /api/onboarding: 200 acknowledged=true — happy path with all three checkboxes true', async () => {
    const userId = 'post-happy-001';
    const token = makeJwt(userId);
    const res = await request(app)
      .post('/api/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .send({ checkbox1: true, checkbox2: true, checkbox3: true });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { acknowledged: true }, error: null, status: 200 });

    // Verify 1 row in DB
    const count = db
      .prepare<[string], { n: number }>(
        'SELECT COUNT(*) AS n FROM onboarding_ack WHERE user_id = ?'
      )
      .get(userId);
    expect(count?.n).toBe(1);

    // acknowledged_at parseable as ISO 8601
    const row = db
      .prepare<[string], { acknowledged_at: string }>(
        'SELECT acknowledged_at FROM onboarding_ack WHERE user_id = ?'
      )
      .get(userId);
    expect(new Date(row!.acknowledged_at).toISOString()).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // CA-9: POST 422 when any checkbox is false (3 sub-tests)
  // ---------------------------------------------------------------------------

  it('POST /api/onboarding: 422 — checkbox1=false, DB unmodified', async () => {
    const userId = 'post-cb1-false';
    const token = makeJwt(userId);
    const res = await request(app)
      .post('/api/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .send({ checkbox1: false, checkbox2: true, checkbox3: true });
    expect(res.status).toBe(422);
    expect(res.body.data).toBeNull();
    expect(res.body.status).toBe(422);
    expect(typeof res.body.error).toBe('string');

    const count = db
      .prepare<[string], { n: number }>(
        'SELECT COUNT(*) AS n FROM onboarding_ack WHERE user_id = ?'
      )
      .get(userId);
    expect(count?.n).toBe(0);
  });

  it('POST /api/onboarding: 422 — checkbox2=false, DB unmodified', async () => {
    const userId = 'post-cb2-false';
    const token = makeJwt(userId);
    const res = await request(app)
      .post('/api/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .send({ checkbox1: true, checkbox2: false, checkbox3: true });
    expect(res.status).toBe(422);
    expect(res.body.data).toBeNull();
    expect(res.body.status).toBe(422);

    const count = db
      .prepare<[string], { n: number }>(
        'SELECT COUNT(*) AS n FROM onboarding_ack WHERE user_id = ?'
      )
      .get(userId);
    expect(count?.n).toBe(0);
  });

  it('POST /api/onboarding: 422 — checkbox3=false, DB unmodified', async () => {
    const userId = 'post-cb3-false';
    const token = makeJwt(userId);
    const res = await request(app)
      .post('/api/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .send({ checkbox1: true, checkbox2: true, checkbox3: false });
    expect(res.status).toBe(422);
    expect(res.body.data).toBeNull();
    expect(res.body.status).toBe(422);

    const count = db
      .prepare<[string], { n: number }>(
        'SELECT COUNT(*) AS n FROM onboarding_ack WHERE user_id = ?'
      )
      .get(userId);
    expect(count?.n).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // CA-10: POST 422 when field missing
  // ---------------------------------------------------------------------------

  it('POST /api/onboarding: 422 missing checkbox3 field — field required', async () => {
    const userId = 'post-missing-cb3';
    const token = makeJwt(userId);
    const res = await request(app)
      .post('/api/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .send({ checkbox1: true, checkbox2: true });
    expect(res.status).toBe(422);
    expect(res.body.data).toBeNull();
    expect(res.body.status).toBe(422);
    expect(typeof res.body.error).toBe('string');
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // CA-11: POST idempotent — two calls leave 1 row
  // ---------------------------------------------------------------------------

  it('POST /api/onboarding: idempotent — same user ack twice leaves 1 row (upsert)', async () => {
    const userId = 'post-idempotent-001';
    const token = makeJwt(userId);

    const res1 = await request(app)
      .post('/api/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .send({ checkbox1: true, checkbox2: true, checkbox3: true });
    expect(res1.status).toBe(200);

    const res2 = await request(app)
      .post('/api/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .send({ checkbox1: true, checkbox2: true, checkbox3: true });
    expect(res2.status).toBe(200);

    const count = db
      .prepare<[string], { n: number }>(
        'SELECT COUNT(*) AS n FROM onboarding_ack WHERE user_id = ?'
      )
      .get(userId);
    expect(count?.n).toBe(1);
  });
});
