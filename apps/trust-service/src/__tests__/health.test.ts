import request from 'supertest';
import { createApp } from '../server';

describe('GET /health', () => {
  it('200 shape skeleton — {data:{status:"ok"},error:null,status:200}', async () => {
    // health no requiere auth ni DB
    process.env.JWT_SECRET = 'a-test-secret-for-tests-only';
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: 'ok' }, error: null, status: 200 });
  });
});
