import request from 'supertest';
import { createDatabase } from '../service/database';
import { createUploadRepository } from '../service/upload-repository';
import { createApp } from '../server';

describe('GET /health', () => {
  const db = createDatabase(':memory:');
  const repo = createUploadRepository(db);
  const app = createApp({
    db,
    repo,
    signingKey: 'test-only-signing-key-0123456789abcdef',
    identityUrl: 'http://identity-test.invalid',
  });

  afterAll(() => {
    db.close();
  });

  it('responde 200 con shape { data: { status: "ok" }, error: null, status: 200 }', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: { status: 'ok' },
      error: null,
      status: 200,
    });
  });

  it('responde sin autenticación (no requiere JWT)', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
});
