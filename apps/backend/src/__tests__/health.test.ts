import request from 'supertest';
import { createApp } from '../server';

const app = createApp();

describe('GET /health', () => {
  it('returns 200 with {data, error, status} structure', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('status');
    expect(res.body.error).toBeNull();
    expect(res.body.status).toBe(200);
    expect(res.body.data).toEqual({ status: 'ok' });
  });

  it('returns Content-Type application/json', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/unknown-route');
    expect(res.status).toBe(404);
  });
});
