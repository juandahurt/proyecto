/**
 * Tests para GET /health.
 * CA-14: responde 200 con body {data:{status:"ok"},error:null,status:200}.
 */
import request from 'supertest';
import { createApp } from '../server';
import { createDatabase } from '../service/database';
import { createUserRepository } from '../service/user-repository';

describe('GET /health', () => {
  it('CA-14 — 200 con shape {data:{status:"ok"},error:null,status:200}', async () => {
    const db = createDatabase(':memory:');
    const repo = createUserRepository(db);
    const app = createApp({ db, repo });

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: { status: 'ok' },
      error: null,
      status: 200,
    });
  });
});
