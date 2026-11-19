import request from 'supertest';
import { createApp } from '../server';
import { startFakeIdentity, limitsBody } from './fake-identity';
import {
  ID_1,
  ID_2,
  TEST_SECRET,
  listBody,
  makeJwt,
  readyItem,
  startFakeIngestion,
} from './fake-ingestion';

describe('createApp', () => {
  const saved = process.env.INGESTION_URL;
  const savedIdentity = process.env.IDENTITY_URL;
  afterEach(() => {
    if (saved === undefined) delete process.env.INGESTION_URL;
    else process.env.INGESTION_URL = saved;
    if (savedIdentity === undefined) delete process.env.IDENTITY_URL;
    else process.env.IDENTITY_URL = savedIdentity;
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
    process.env.IDENTITY_URL = 'http://127.0.0.1:1';
    expect(() => createApp()).not.toThrow();
  });

  it('lanza si falta IDENTITY_URL (obligatoria), nombrando la variable sin valores', () => {
    process.env.INGESTION_URL = 'http://127.0.0.1:1';
    delete process.env.IDENTITY_URL;
    expect(() => createApp()).toThrow('IDENTITY_URL is required');
  });

  it('GET /health es publico (200 sin JWT) aunque ingestion no exista', async () => {
    const app = createApp({
      ingestionUrl: 'http://127.0.0.1:1',
      identityUrl: 'http://127.0.0.1:1',
    });
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: 'ok' }, error: null, status: 200 });
  });

  it('rutas desconocidas -> 404 con envoltorio uniforme', async () => {
    const app = createApp({
      ingestionUrl: 'http://127.0.0.1:1',
      identityUrl: 'http://127.0.0.1:1',
    });
    const res = await request(app).get('/api/otra');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ data: null, error: 'Not Found', status: 404 });
    const res2 = await request(app).get('/api/trends/otra');
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
        const app = createApp({ ingestionUrl: fake.url, identityUrl: 'http://127.0.0.1:1' });
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
  describe('C-56: configuracion TREND_* al arrancar', () => {
    const names = [
      'TREND_MIN_UPLOADS',
      'TREND_SLOPE_IMPROVING',
      'TREND_SLOPE_WORSENING',
      'IDENTITY_TIMEOUT_MS',
      'JWT_SECRET',
    ];
    const savedEnv: Record<string, string | undefined> = {};
    beforeEach(() => names.forEach((n) => (savedEnv[n] = process.env[n])));
    afterEach(() =>
      names.forEach((n) => {
        if (savedEnv[n] === undefined) delete process.env[n];
        else process.env[n] = savedEnv[n];
      })
    );
    const deps = { ingestionUrl: 'http://127.0.0.1:1', identityUrl: 'http://127.0.0.1:1' };

    it.each([
      ['TREND_MIN_UPLOADS', 'abc-secreto'],
      ['TREND_MIN_UPLOADS', '1'],
      ['TREND_SLOPE_IMPROVING', 'xyz-secreto'],
      ['TREND_SLOPE_WORSENING', 'xyz-secreto'],
    ])('createApp lanza nombrando %s=%s sin eco del valor', (name, value) => {
      process.env[name] = value;
      let message = '';
      try {
        createApp(deps);
      } catch (e) {
        message = (e as Error).message;
      }
      expect(message).toContain(name);
      expect(message).not.toContain('secreto');
    });

    it('TREND_MIN_UPLOADS=2: dos uploads calificados ya dan tendencia (por su efecto)', async () => {
      const ing = await startFakeIngestion();
      const idn = await startFakeIdentity();
      try {
        process.env.JWT_SECRET = TEST_SECRET;
        process.env.TREND_MIN_UPLOADS = '2';
        idn.respond(200, limitsBody('paid'));
        ing.respond(
          200,
          listBody([
            readyItem(ID_1, '2026-11-03T10:00:00.000Z'),
            readyItem(ID_2, '2026-11-02T10:00:00.000Z'),
          ])
        );
        const res = await request(createApp({ ingestionUrl: ing.url, identityUrl: idn.url }))
          .get('/api/trends')
          .set('Authorization', `Bearer ${makeJwt()}`);
        expect(res.status).toBe(200);
        expect(res.body.data.categories.map((c: { status: string }) => c.status)).toEqual(
          Array(5).fill('stagnating')
        );
      } finally {
        await ing.close();
        await idn.close();
      }
    });

    it('sin TREND_MIN_UPLOADS (default 4) los mismos dos uploads dan insufficient_data', async () => {
      const ing = await startFakeIngestion();
      const idn = await startFakeIdentity();
      try {
        process.env.JWT_SECRET = TEST_SECRET;
        delete process.env.TREND_MIN_UPLOADS;
        idn.respond(200, limitsBody('paid'));
        ing.respond(
          200,
          listBody([
            readyItem(ID_1, '2026-11-03T10:00:00.000Z'),
            readyItem(ID_2, '2026-11-02T10:00:00.000Z'),
          ])
        );
        const res = await request(createApp({ ingestionUrl: ing.url, identityUrl: idn.url }))
          .get('/api/trends')
          .set('Authorization', `Bearer ${makeJwt()}`);
        expect(res.body.data.categories[0]).toMatchObject({
          status: 'insufficient_data',
          uploadsNeeded: 2,
        });
      } finally {
        await ing.close();
        await idn.close();
      }
    });

    it('IDENTITY_TIMEOUT_MS=50 con un identity lento responde 504 (por su efecto)', async () => {
      const ing = await startFakeIngestion();
      const idn = await startFakeIdentity();
      try {
        process.env.JWT_SECRET = TEST_SECRET;
        process.env.IDENTITY_TIMEOUT_MS = '50';
        idn.respond(200, limitsBody('paid'), 600);
        ing.respond(200, listBody([]));
        const res = await request(createApp({ ingestionUrl: ing.url, identityUrl: idn.url }))
          .get('/api/trends')
          .set('Authorization', `Bearer ${makeJwt()}`);
        expect(res.status).toBe(504);
        expect(res.body).toEqual({ data: null, error: 'Upstream timeout', status: 504 });
        expect(ing.requests).toHaveLength(0);
      } finally {
        await ing.close();
        await idn.close();
      }
    });

    it('IDENTITY_TIMEOUT_MS invalido cae al valor por defecto (5000), no a 0', async () => {
      const ing = await startFakeIngestion();
      const idn = await startFakeIdentity();
      try {
        process.env.JWT_SECRET = TEST_SECRET;
        process.env.IDENTITY_TIMEOUT_MS = 'no-es-numero';
        idn.respond(200, limitsBody('paid'), 150);
        ing.respond(200, listBody([]));
        const res = await request(createApp({ ingestionUrl: ing.url, identityUrl: idn.url }))
          .get('/api/trends')
          .set('Authorization', `Bearer ${makeJwt()}`);
        expect(res.status).toBe(200);
      } finally {
        await ing.close();
        await idn.close();
      }
    });
  });
});
