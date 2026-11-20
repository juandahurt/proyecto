import request from 'supertest';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { createApp } from '../server';
import { createDatabase } from '../service/database';
import { FetchFn } from '../service/ingestion-client';

const TEST_SECRET = 'a-test-secret-for-tests-only';

function makeJwt(userId: string): string {
  return jwt.sign({ sub: userId }, TEST_SECRET, { algorithm: 'HS256', expiresIn: '7d' });
}

interface Call {
  url: string;
  headers: Record<string, string>;
}

function makeFetchFn(
  calls: Call[],
  behavior: (url: string) => { ok: true } | { ok: false }
): FetchFn {
  return (async (url: string, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    const h = init?.headers as Record<string, string> | undefined;
    if (h) {
      for (const [k, v] of Object.entries(h)) headers[k] = v;
    }
    calls.push({ url: String(url), headers });
    const outcome = behavior(String(url));
    if (!outcome.ok) {
      throw new Error('simulated network failure');
    }
    return new Response(null, { status: 204 });
  }) as unknown as FetchFn;
}

function makeApp(fetchFn: FetchFn, db: Database.Database) {
  return createApp({
    db,
    fetchFn,
    ingestionUrl: 'http://ingestion-service:3200',
    identityUrl: 'http://identity-service:3100',
  });
}

describe('DELETE /api/history — cascada best-effort', () => {
  let db: Database.Database;

  beforeAll(() => {
    process.env.JWT_SECRET = TEST_SECRET;
  });
  afterAll(() => {
    delete process.env.JWT_SECRET;
  });

  beforeEach(() => {
    db = createDatabase(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('CA-6: ambos pasos 204 -> trust responde 204; ingestion se llama antes que identity', async () => {
    const calls: Call[] = [];
    const fetchFn = makeFetchFn(calls, () => ({ ok: true }));
    const app = makeApp(fetchFn, db);
    const token = makeJwt('user-1');

    const res = await request(app)
      .delete('/api/history')
      .set('Authorization', `Bearer ${token}`)
      .send({ confirmation: 'DELETE' });

    expect(res.status).toBe(204);
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toContain('ingestion-service');
    expect(calls[1].url).toContain('identity-service');
  });

  it('CA-6: ingestion falla pero identity responde 204 -> trust igual llama a identity y responde 204', async () => {
    const calls: Call[] = [];
    const fetchFn = makeFetchFn(calls, (url) => ({ ok: !url.includes('ingestion-service') }));
    const app = makeApp(fetchFn, db);
    const token = makeJwt('user-1');

    const res = await request(app)
      .delete('/api/history')
      .set('Authorization', `Bearer ${token}`)
      .send({ confirmation: 'DELETE' });

    expect(res.status).toBe(204);
    expect(calls).toHaveLength(2);
    expect(calls.some((c) => c.url.includes('identity-service'))).toBe(true);
  });

  it('CA-6: identity falla pero ingestion responde 204 -> trust responde 204', async () => {
    const calls: Call[] = [];
    const fetchFn = makeFetchFn(calls, (url) => ({ ok: !url.includes('identity-service') }));
    const app = makeApp(fetchFn, db);
    const token = makeJwt('user-1');

    const res = await request(app)
      .delete('/api/history')
      .set('Authorization', `Bearer ${token}`)
      .send({ confirmation: 'DELETE' });

    expect(res.status).toBe(204);
  });

  it('CA-6: ambos fallan -> trust responde 500', async () => {
    const calls: Call[] = [];
    const fetchFn = makeFetchFn(calls, () => ({ ok: false }));
    const app = makeApp(fetchFn, db);
    const token = makeJwt('user-1');

    const res = await request(app)
      .delete('/api/history')
      .set('Authorization', `Bearer ${token}`)
      .send({ confirmation: 'DELETE' });

    expect(res.status).toBe(500);
  });

  it('CA-6: ninguna llamada reenvia Authorization del usuario a los endpoints internos', async () => {
    const calls: Call[] = [];
    const fetchFn = makeFetchFn(calls, () => ({ ok: true }));
    const app = makeApp(fetchFn, db);
    const token = makeJwt('user-1');

    await request(app)
      .delete('/api/history')
      .set('Authorization', `Bearer ${token}`)
      .send({ confirmation: 'DELETE' });

    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.headers.Authorization).toBeUndefined();
      expect(call.headers.authorization).toBeUndefined();
    }
  });
});
