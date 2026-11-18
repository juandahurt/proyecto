import request from 'supertest';
import { createApp } from '../server';
import { TEST_SECRET, listBody, makeJwt, startFakeIngestion } from './fake-ingestion';

describe('createApp', () => {
  const saved = process.env.INGESTION_URL;
  afterEach(() => {
    if (saved === undefined) delete process.env.INGESTION_URL;
    else process.env.INGESTION_URL = saved;
  });

  it('lanza si falta INGESTION_URL (obligatoria), nombrando la variable sin valores', () => {
    delete process.env.INGESTION_URL;
    expect(() => createApp()).toThrow(/INGESTION_URL/);
    try {
      createApp();
    } catch (e) {
      expect((e as Error).message).toBe('INGESTION_URL is required');
    }
  });

  it('toma INGESTION_URL del entorno si no se inyecta', () => {
    process.env.INGESTION_URL = 'http://127.0.0.1:1';
    expect(() => createApp()).not.toThrow();
  });

  it('GET /health es publico (200 sin JWT) aunque ingestion no exista', async () => {
    const app = createApp({ ingestionUrl: 'http://127.0.0.1:1' });
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: 'ok' }, error: null, status: 200 });
  });

  it('rutas desconocidas -> 404 con envoltorio uniforme', async () => {
    const app = createApp({ ingestionUrl: 'http://127.0.0.1:1' });
    const res = await request(app).get('/api/otra');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ data: null, error: 'Not Found', status: 404 });
    const res2 = await request(app).get('/api/trends');
    expect(res2.status).toBe(404);
  });

  describe('INGESTION_TIMEOUT_MS del entorno (por su efecto)', () => {
    const savedTimeout = process.env.INGESTION_TIMEOUT_MS;
    const savedSecret = process.env.JWT_SECRET;
    afterEach(() => {
      if (savedTimeout === undefined) delete process.env.INGESTION_TIMEOUT_MS;
      else process.env.INGESTION_TIMEOUT_MS = savedTimeout;
      if (savedSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = savedSecret;
    });

    it('con la variable en 50 y un ingestion lento responde 504', async () => {
      const fake = await startFakeIngestion();
      try {
        process.env.JWT_SECRET = TEST_SECRET;
        process.env.INGESTION_TIMEOUT_MS = '50';
        fake.respond(200, listBody([]), 600);
        const app = createApp({ ingestionUrl: fake.url });
        const res = await request(app)
          .get('/api/trends/history')
          .set('Authorization', `Bearer ${makeJwt()}`);
        expect(res.status).toBe(504);
        expect(res.body).toEqual({ data: null, error: 'Upstream timeout', status: 504 });
      } finally {
        await fake.close();
      }
    });
  });
});
