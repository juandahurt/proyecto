import request from 'supertest';
import { createApp } from '../server';
import { createDatabase } from '../service/database';
import { createUserRepository } from '../service/user-repository';
import { createUploadCounterRepository } from '../service/upload-counter-repository';

const TEST_SECRET = 'a-test-secret-for-tests-only';
const VALID_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const URL_BASE = '/api/internal/users/' + VALID_UUID + '/increment-counter';

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

describe('POST /api/internal/users/:userId/increment-counter', () => {
  it('CA-11: no-auth-internal — acepta request SIN header Authorization y devuelve 200', async () => {
    const { app } = makeApp();
    const res = await request(app).post(URL_BASE);
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(1);
  });

  it('CA-9: primera invocacion devuelve count=1', async () => {
    const { app } = makeApp();
    const res = await request(app).post(URL_BASE);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ data: { count: 1 }, error: null, status: 200 });
  });

  it('CA-9: segunda invocacion devuelve count=2', async () => {
    const { app } = makeApp();
    await request(app).post(URL_BASE);
    const res = await request(app).post(URL_BASE);
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(2);
  });

  it('CA-9: getForMonth refleja el count tras el incremento', async () => {
    const { app, counterRepo } = makeApp();
    await request(app).post(URL_BASE);
    await request(app).post(URL_BASE);
    const { currentYearMonth } = await import('../service/clock');
    expect(counterRepo.getForMonth(VALID_UUID, currentYearMonth())).toBe(2);
  });

  it('CA-10: bad-user-uuid — userId invalido (no uuid) devuelve 422', async () => {
    const { app } = makeApp();
    const res = await request(app).post('/api/internal/users/not-a-valid-uuid/increment-counter');
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ data: null, status: 422 });
    expect(typeof res.body.error).toBe('string');
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  it('CA-10: invalid-uuid BD inalterada — 0 filas despues del 422', async () => {
    const { app, db } = makeApp();
    const before = (db.prepare('SELECT COUNT(*) as c FROM upload_counters').get() as { c: number })
      .c;
    await request(app).post('/api/internal/users/not-a-valid-uuid/increment-counter');
    const after = (db.prepare('SELECT COUNT(*) as c FROM upload_counters').get() as { c: number })
      .c;
    expect(after).toBe(before);
  });

  it('CA-9: usuarios distintos tienen contadores independientes', async () => {
    const { app } = makeApp();
    const userA = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const userB = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    await request(app).post('/api/internal/users/' + userA + '/increment-counter');
    await request(app).post('/api/internal/users/' + userA + '/increment-counter');
    const resB = await request(app).post('/api/internal/users/' + userB + '/increment-counter');
    expect(resB.body.data.count).toBe(1);
  });
});
