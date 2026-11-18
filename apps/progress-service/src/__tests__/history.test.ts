import request from 'supertest';
import { UploadListSchema } from '@proyecto/shared-types';
import { createApp } from '../server';
import {
  FakeIngestion,
  ID_1,
  ID_2,
  ID_3,
  TEST_SECRET,
  closedPortUrl,
  listBody,
  lowItem,
  makeJwt,
  readyItem,
  startFakeIngestion,
} from './fake-ingestion';

const T1 = '2026-11-03T10:00:00.000Z';
const T2 = '2026-11-02T10:00:00.000Z';
const T3 = '2026-11-01T10:00:00.000Z';

describe('GET /api/trends/history', () => {
  let fake: FakeIngestion;
  let originalSecret: string | undefined;
  let spies: jest.SpyInstance[];

  beforeAll(() => {
    originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_SECRET;
  });
  afterAll(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });
  beforeEach(async () => {
    fake = await startFakeIngestion();
    spies = [
      jest.spyOn(console, 'log').mockImplementation(() => undefined),
      jest.spyOn(console, 'warn').mockImplementation(() => undefined),
      jest.spyOn(console, 'error').mockImplementation(() => undefined),
    ];
  });
  afterEach(async () => {
    spies.forEach((s) => s.mockRestore());
    await fake.close();
  });

  function app(timeoutMs = 2000) {
    return createApp({ ingestionUrl: fake.url, timeoutMs });
  }

  function loggedText(): string {
    return spies.map((s) => JSON.stringify(s.mock.calls)).join('\n');
  }

  describe('camino feliz (200)', () => {
    it('200 con 3 items ready, mismo orden que ingestion, sin reordenar, y pasa UploadListSchema', async () => {
      const items = [readyItem(ID_1, T1), readyItem(ID_2, T2), readyItem(ID_3, T3)];
      fake.respond(200, listBody(items));
      const res = await request(app())
        .get('/api/trends/history')
        .set('Authorization', `Bearer ${makeJwt()}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: { items }, error: null, status: 200 });
      expect(res.body.data.items.map((i: { uploadId: string }) => i.uploadId)).toEqual([
        ID_1,
        ID_2,
        ID_3,
      ]);
      expect(UploadListSchema.safeParse(res.body).success).toBe(true);
    });

    it('orden no cronologico de ingestion se conserva (sin reordenar ni filtrar)', async () => {
      const items = [readyItem(ID_3, T3), readyItem(ID_1, T1), lowItem(ID_2, T2)];
      fake.respond(200, listBody(items));
      const res = await request(app())
        .get('/api/trends/history')
        .set('Authorization', `Bearer ${makeJwt()}`);
      expect(res.body.data.items.map((i: { uploadId: string }) => i.uploadId)).toEqual([
        ID_3,
        ID_1,
        ID_2,
      ]);
    });

    it('mezcla ready + low_confidence conserva scores [] y fallbackReason', async () => {
      const items = [readyItem(ID_1, T1), lowItem(ID_2, T2)];
      fake.respond(200, listBody(items));
      const res = await request(app())
        .get('/api/trends/history')
        .set('Authorization', `Bearer ${makeJwt()}`);
      expect(res.status).toBe(200);
      expect(res.body.data.items[1].scores).toEqual([]);
      expect(res.body.data.items[1].fallbackReason).toBe('low_confidence_flag');
      expect(res.body.data.items[0]).not.toHaveProperty('fallbackReason');
    });

    it('items vacio: 200 con items []', async () => {
      fake.respond(200, listBody([]));
      const res = await request(app())
        .get('/api/trends/history')
        .set('Authorization', `Bearer ${makeJwt()}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: { items: [] }, error: null, status: 200 });
    });
  });

  describe('reenvio del JWT (cabeceras, ruta, query)', () => {
    it('reenvia Authorization identico, sin Cookie ni X-Forwarded-*, GET sin cuerpo', async () => {
      fake.respond(200, listBody([]));
      const auth = `Bearer ${makeJwt()}`;
      await request(app())
        .get('/api/trends/history')
        .set('Authorization', auth)
        .set('Cookie', 'sid=abc')
        .set('X-Forwarded-For', '10.1.2.3')
        .set('X-Forwarded-Host', 'evil.example')
        .set('X-Custom', 'cliente');
      expect(fake.requests).toHaveLength(1);
      const r = fake.requests[0];
      expect(r.method).toBe('GET');
      expect(r.body).toBe('');
      expect(r.headers.authorization).toBe(auth);
      expect(r.headers.cookie).toBeUndefined();
      expect(r.headers['x-forwarded-for']).toBeUndefined();
      expect(r.headers['x-forwarded-host']).toBeUndefined();
      expect(r.headers['x-custom']).toBeUndefined();
      // solo cabeceras que pone el propio cliente HTTP (nada del cliente original)
      const extra = Object.keys(r.headers).filter(
        (h) =>
          ![
            'authorization',
            'host',
            'connection',
            'accept',
            'accept-language',
            'sec-fetch-mode',
            'user-agent',
            'accept-encoding',
          ].includes(h)
      );
      expect(extra).toEqual([]);
    });

    it('ruta exactamente /api/uploads sin query aunque el cliente mande ?userId= de otro usuario', async () => {
      fake.respond(200, listBody([]));
      await request(app())
        .get('/api/trends/history?userId=otro-usuario-999&limit=1')
        .set('Authorization', `Bearer ${makeJwt()}`);
      expect(fake.requests[0].url).toBe('/api/uploads');
    });
  });

  describe('autenticacion en el servicio', () => {
    it('sin JWT: 401 unauthenticated y ingestion recibe 0 peticiones', async () => {
      const res = await request(app()).get('/api/trends/history');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ data: null, error: 'unauthenticated', status: 401 });
      expect(fake.requests).toHaveLength(0);
    });

    it('JWT mal firmado: 401 y 0 peticiones', async () => {
      const bad = makeJwt().slice(0, -3) + 'abc';
      const res = await request(app())
        .get('/api/trends/history')
        .set('Authorization', `Bearer ${bad}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthenticated');
      expect(fake.requests).toHaveLength(0);
    });

    it('JWT expirado: 401 y 0 peticiones', async () => {
      const expired = makeJwt('u', { expiresIn: -60 });
      const res = await request(app())
        .get('/api/trends/history')
        .set('Authorization', `Bearer ${expired}`);
      expect(res.status).toBe(401);
      expect(fake.requests).toHaveLength(0);
    });
  });

  describe('mapeo de errores aguas arriba', () => {
    const auth = () => `Bearer ${makeJwt()}`;
    const UNAVAILABLE = { data: null, error: 'Upstream unavailable', status: 502 };
    const BAD = { data: null, error: 'Bad upstream response', status: 502 };
    const SECRET_BODY = 'cuerpo-interno-de-ingestion-xyz';

    it('ingestion 401 -> 401 unauthenticated', async () => {
      fake.respond(401, JSON.stringify({ data: null, error: 'unauthenticated', status: 401 }));
      const res = await request(app()).get('/api/trends/history').set('Authorization', auth());
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ data: null, error: 'unauthenticated', status: 401 });
    });

    it.each([500, 503, 403, 404, 418])(
      'ingestion %i -> 502 Upstream unavailable sin filtrar cuerpo',
      async (code) => {
        fake.respond(code, SECRET_BODY);
        const res = await request(app()).get('/api/trends/history').set('Authorization', auth());
        expect(res.status).toBe(502);
        expect(res.body).toEqual(UNAVAILABLE);
        expect(JSON.stringify(res.body)).not.toContain(SECRET_BODY);
        expect(JSON.stringify(res.body)).not.toContain(fake.url);
      }
    );

    it('conexion rechazada (puerto cerrado) -> 502 Upstream unavailable', async () => {
      const closed = await closedPortUrl();
      const res = await request(createApp({ ingestionUrl: closed, timeoutMs: 2000 }))
        .get('/api/trends/history')
        .set('Authorization', auth());
      expect(res.status).toBe(502);
      expect(res.body).toEqual(UNAVAILABLE);
      expect(JSON.stringify(res.body)).not.toContain(closed);
    });

    it('lento mas que el timeout -> 504 Upstream timeout', async () => {
      fake.respond(200, listBody([]), 600);
      const res = await request(app(50)).get('/api/trends/history').set('Authorization', auth());
      expect(res.status).toBe(504);
      expect(res.body).toEqual({ data: null, error: 'Upstream timeout', status: 504 });
    });

    it('cuerpo no JSON -> 502 Bad upstream response', async () => {
      fake.respond(200, SECRET_BODY);
      const res = await request(app()).get('/api/trends/history').set('Authorization', auth());
      expect(res.status).toBe(502);
      expect(res.body).toEqual(BAD);
      expect(JSON.stringify(res.body)).not.toContain(SECRET_BODY);
    });

    it('JSON con campo requerido faltante (sin items) -> 502 Bad upstream response', async () => {
      fake.respond(200, JSON.stringify({ data: {}, error: null, status: 200 }));
      const res = await request(app()).get('/api/trends/history').set('Authorization', auth());
      expect(res.status).toBe(502);
      expect(res.body).toEqual(BAD);
    });

    it('status distinto de 200 en el envoltorio -> 502 Bad upstream response', async () => {
      fake.respond(200, JSON.stringify({ data: { items: [] }, error: null, status: 201 }));
      const res = await request(app()).get('/api/trends/history').set('Authorization', auth());
      expect(res.status).toBe(502);
      expect(res.body).toEqual(BAD);
    });

    it('item valido salvo un campo requerido faltante (timestamp) -> 502 Bad upstream response', async () => {
      const item = readyItem(ID_1, T1);
      delete item.timestamp;
      fake.respond(200, listBody([item]));
      const res = await request(app()).get('/api/trends/history').set('Authorization', auth());
      expect(res.status).toBe(502);
      expect(res.body).toEqual(BAD);
    });

    it('item valido salvo un valor fuera de enum (status) -> 502 Bad upstream response', async () => {
      const item = { ...readyItem(ID_1, T1), status: 'otro' };
      fake.respond(200, listBody([item]));
      const res = await request(app()).get('/api/trends/history').set('Authorization', auth());
      expect(res.status).toBe(502);
      expect(res.body).toEqual(BAD);
    });
  });

  describe('logs', () => {
    it('ningun log contiene JWT, userId, uploadId ni cuerpo de ingestion en los casos de error', async () => {
      const userId = 'user-que-no-debe-filtrarse';
      const token = makeJwt(userId);
      const SECRET_BODY = 'cuerpo-interno-de-ingestion-xyz';
      const cases: Array<[number, string, number]> = [
        [401, SECRET_BODY, 0],
        [500, SECRET_BODY, 0],
        [200, SECRET_BODY, 0],
        [200, listBody([{ ...readyItem(ID_1, T1), status: 'x' }]), 0],
      ];
      for (const [code, body] of cases) {
        fake.respond(code, body);
        await request(app()).get('/api/trends/history').set('Authorization', `Bearer ${token}`);
      }
      fake.respond(200, listBody([]), 600);
      await request(app(50)).get('/api/trends/history').set('Authorization', `Bearer ${token}`);
      const closed = await closedPortUrl();
      await request(createApp({ ingestionUrl: closed, timeoutMs: 2000 }))
        .get('/api/trends/history')
        .set('Authorization', `Bearer ${token}`);

      const text = loggedText();
      expect(text).toContain('[history]'); // la espia si ve las marcas
      expect(text).not.toContain(token);
      expect(text.toLowerCase()).not.toContain('bearer');
      expect(text).not.toContain(userId);
      expect(text).not.toContain(ID_1);
      expect(text).not.toContain(SECRET_BODY);
      expect(text).not.toContain(fake.url);
      expect(text).not.toContain(closed);
    });
  });
});
