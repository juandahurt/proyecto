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

function makeFetchFn(callCounter: { count: number }): FetchFn {
  return (async () => {
    callCounter.count += 1;
    return new Response(null, { status: 204 });
  }) as unknown as FetchFn;
}

describe('DELETE /api/history — validacion de confirmacion', () => {
  let db: Database.Database;
  let app: ReturnType<typeof createApp>;
  let callCounter: { count: number };

  beforeAll(() => {
    process.env.JWT_SECRET = TEST_SECRET;
  });
  afterAll(() => {
    delete process.env.JWT_SECRET;
  });

  beforeEach(() => {
    db = createDatabase(':memory:');
    callCounter = { count: 0 };
    app = createApp({
      db,
      fetchFn: makeFetchFn(callCounter),
      ingestionUrl: 'http://ingestion-service:3200',
      identityUrl: 'http://identity-service:3100',
    });
  });

  afterEach(() => {
    db.close();
  });

  it('CA-5: sin Authorization -> 401', async () => {
    const res = await request(app).delete('/api/history').send({ confirmation: 'DELETE' });
    expect(res.status).toBe(401);
    expect(callCounter.count).toBe(0);
  });

  it('CA-5: token valido, body {} -> 400, sin llamar a ingestion ni identity', async () => {
    const token = makeJwt('user-1');
    const res = await request(app)
      .delete('/api/history')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(callCounter.count).toBe(0);
  });

  it('CA-5: confirmation en minusculas -> 400, sin llamar a los internos', async () => {
    const token = makeJwt('user-1');
    const res = await request(app)
      .delete('/api/history')
      .set('Authorization', `Bearer ${token}`)
      .send({ confirmation: 'delete' });
    expect(res.status).toBe(400);
    expect(callCounter.count).toBe(0);
  });

  it('CA-5: confirmation con espacio -> 400, sin llamar a los internos', async () => {
    const token = makeJwt('user-1');
    const res = await request(app)
      .delete('/api/history')
      .set('Authorization', `Bearer ${token}`)
      .send({ confirmation: 'DELETE ' });
    expect(res.status).toBe(400);
    expect(callCounter.count).toBe(0);
  });

  it('CA-5: confirmation exacta "DELETE" -> procede a la cascada (llama a ambos internos)', async () => {
    const token = makeJwt('user-1');
    const res = await request(app)
      .delete('/api/history')
      .set('Authorization', `Bearer ${token}`)
      .send({ confirmation: 'DELETE' });
    expect(res.status).toBe(204);
    expect(callCounter.count).toBe(2);
  });
});
