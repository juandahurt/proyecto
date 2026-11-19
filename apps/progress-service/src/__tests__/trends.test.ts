import request from 'supertest';
import { TrendResponseSchema } from '@proyecto/shared-types';
import { createApp } from '../server';
import { FakeIdentity, limitsBody, startFakeIdentity } from './fake-identity';
import {
  FakeIngestion,
  TEST_SECRET,
  closedPortUrl,
  listBody,
  makeJwt,
  startFakeIngestion,
} from './fake-ingestion';

const USER_ID = 'user-test-abc-123';
const JWT = makeJwt(USER_ID);
const AUTH = `Bearer ${JWT}`;

/** Id con forma de UUID v4 distinto por upload (1..6). */
const uid = (n: number): string => {
  const d = String(n);
  return `${d.repeat(8)}-${d.repeat(4)}-4${d.repeat(3)}-8${d.repeat(3)}-${d.repeat(12)}`;
};
const ts = (n: number): string => `2026-11-0${n}T10:00:00.000Z`;

/**
 * 6 uploads calificados (de 1 = mas antiguo a 6). Ingestion los devuelve mas reciente primero.
 * CAT-1 mejora (+10/upload), CAT-2 empeora (-10), CAT-3 estable, CAT-4 mejora,
 * CAT-5 solo aparece en 3 uploads -> insufficient_data (faltan 1).
 */
function sixUploads(): Record<string, unknown>[] {
  const items = [1, 2, 3, 4, 5, 6].map((n) => {
    const scores = [
      { categoryId: 'CAT-1', score: 10 * n },
      { categoryId: 'CAT-2', score: 70 - 10 * n },
      { categoryId: 'CAT-3', score: 50 },
      { categoryId: 'CAT-4', score: 20 + 10 * n },
    ];
    if (n % 2 === 0) scores.push({ categoryId: 'CAT-5', score: 33 });
    return { uploadId: uid(n), status: 'ready', confidence: 'HIGH', timestamp: ts(n), scores };
  });
  return items.reverse();
}

describe('GET /api/trends', () => {
  let ing: FakeIngestion;
  let idn: FakeIdentity;
  let originalSecret: string | undefined;
  let consoleSpies: jest.SpyInstance[];
  let stdoutSpy: jest.SpyInstance;

  beforeAll(() => {
    originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_SECRET;
  });
  afterAll(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });
  beforeEach(async () => {
    ing = await startFakeIngestion();
    idn = await startFakeIdentity();
    consoleSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined)
    );
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });
  afterEach(async () => {
    consoleSpies.forEach((s) => s.mockRestore());
    stdoutSpy.mockRestore();
    await ing.close();
    await idn.close();
  });

  const app = (over: { ingestionUrl?: string; identityUrl?: string; timeoutMs?: number } = {}) =>
    createApp({
      ingestionUrl: over.ingestionUrl ?? ing.url,
      identityUrl: over.identityUrl ?? idn.url,
      timeoutMs: over.timeoutMs ?? 2000,
      identityTimeoutMs: over.timeoutMs ?? 2000,
    });
  const get = (a = app()) => request(a).get('/api/trends').set('Authorization', AUTH);

  /** Todo lo que se escribio en consola o stdout. */
  function logged(): string {
    return [...consoleSpies, stdoutSpy].map((s) => JSON.stringify(s.mock.calls)).join('\n');
  }

  describe('AC-7.1: tier free, puerta de datos (locked)', () => {
    beforeEach(() => {
      idn.respond(200, limitsBody('free'));
      ing.respond(200, listBody(sixUploads()));
    });

    it('free con 6 uploads: las categorias con tendencia salen locked, sin trend ni uploadsNeeded', async () => {
      const res = await get();
      expect(res.status).toBe(200);
      expect(res.body.data.tier).toBe('free');
      const cats = res.body.data.categories;
      expect(cats.map((c: { categoryId: string }) => c.categoryId)).toEqual([
        'CAT-1',
        'CAT-2',
        'CAT-3',
        'CAT-4',
        'CAT-5',
      ]);
      for (const c of cats.slice(0, 4)) {
        expect(c.status).toBe('locked');
        expect('trend' in c).toBe(false);
        expect('uploadsNeeded' in c).toBe(false);
      }
      // insufficient_data se queda como esta, con su uploadsNeeded
      expect(cats[4]).toEqual({
        categoryId: 'CAT-5',
        categoryName: 'Perspective',
        status: 'insufficient_data',
        uploadsNeeded: 1,
      });
    });

    it('free: el cuerpo serializado no contiene direccion, historial, slope, scores ni uploadIds', async () => {
      const res = await get();
      const raw = JSON.stringify(res.body);
      const forbidden = [
        'improving',
        'stagnating',
        'worsening',
        'scoreHistory',
        'slope',
        '"score"',
        'uploadId',
        'direction',
        'trend"',
        ...[1, 2, 3, 4, 5, 6].flatMap((n) => [uid(n), ts(n)]),
      ];
      for (const f of forbidden) expect(raw).not.toContain(f);
      expect(res.text).not.toMatch(/improving|stagnating|worsening/);
    });
  });

  describe('AC-7.2: tier paid, todo en formato C3', () => {
    it('paid con 6 uploads: tendencias por categoria con scoreHistory cronologico por valor', async () => {
      idn.respond(200, limitsBody('paid'));
      ing.respond(200, listBody(sixUploads()));
      const res = await get();
      expect(res.status).toBe(200);
      expect(TrendResponseSchema.safeParse(res.body).success).toBe(true);
      const cats = res.body.data.categories;
      expect(res.body.data.tier).toBe('paid');
      expect(cats.map((c: { categoryName: string }) => c.categoryName)).toEqual([
        'Composition',
        'Proportions',
        'Line Quality',
        'Values (Shading)',
        'Perspective',
      ]);
      expect(cats.map((c: { status: string }) => c.status)).toEqual([
        'improving',
        'worsening',
        'stagnating',
        'improving',
        'insufficient_data',
      ]);
      expect(cats[0].trend.direction).toBe('improving');
      // Mas antiguo primero, puntos exactos del calculo
      expect(cats[0].trend.scoreHistory).toEqual(
        [1, 2, 3, 4, 5, 6].map((n) => ({ uploadId: uid(n), score: 10 * n, timestamp: ts(n) }))
      );
      expect(cats[1].trend.scoreHistory.map((p: { score: number }) => p.score)).toEqual([
        60, 50, 40, 30, 20, 10,
      ]);
      expect(cats[4]).toEqual({
        categoryId: 'CAT-5',
        categoryName: 'Perspective',
        status: 'insufficient_data',
        uploadsNeeded: 1,
      });
      expect(JSON.stringify(res.body)).not.toContain('slope');
      expect(JSON.stringify(res.body)).not.toContain('qualifiedCount');
    });
  });

  describe('sin cache: cada peticion consulta identity e ingestion', () => {
    it('tres GET seguidos -> contador 3 en identity y 3 en ingestion (cada peticion)', async () => {
      idn.respond(200, limitsBody('free'));
      ing.respond(200, listBody(sixUploads()));
      const a = app();
      for (let i = 0; i < 3; i++) {
        const res = await request(a).get('/api/trends').set('Authorization', AUTH);
        expect(res.status).toBe(200);
      }
      expect(idn.requests).toHaveLength(3);
      expect(ing.requests).toHaveLength(3);
    });

    it('cambia de tier entre dos peticiones (free -> paid): la segunda ya trae trend, sin cache', async () => {
      idn.respond(200, limitsBody('free'));
      ing.respond(200, listBody(sixUploads()));
      const a = app();
      const first = await request(a).get('/api/trends').set('Authorization', AUTH);
      expect(first.body.data.categories[0].status).toBe('locked');
      idn.respond(200, limitsBody('paid'));
      const second = await request(a).get('/api/trends').set('Authorization', AUTH);
      expect(second.body.data.tier).toBe('paid');
      expect(second.body.data.categories[0].status).toBe('improving');
      expect(second.body.data.categories[0].trend.scoreHistory).toHaveLength(6);
    });

    it('cambia de tier tambien en sentido inverso (paid -> free): vuelve a bloquear', async () => {
      idn.respond(200, limitsBody('paid'));
      ing.respond(200, listBody(sixUploads()));
      const a = app();
      await request(a).get('/api/trends').set('Authorization', AUTH);
      idn.respond(200, limitsBody('free'));
      const second = await request(a).get('/api/trends').set('Authorization', AUTH);
      expect(second.body.data.categories[0].status).toBe('locked');
    });
  });

  describe('solo Authorization hacia ambos upstreams; nunca el userId', () => {
    it('identity e ingestion reciben el Authorization identico, ruta exacta y ninguna otra cabecera del cliente', async () => {
      idn.respond(200, limitsBody('paid'));
      ing.respond(200, listBody(sixUploads()));
      const res = await request(app())
        .get('/api/trends?userId=OTRO-ID&tier=paid')
        .set('Authorization', AUTH)
        .set('Cookie', 'sid=1')
        .set('X-Forwarded-For', '1.2.3.4')
        .set('X-User-Id', 'otro');
      expect(res.status).toBe(200);
      expect(idn.requests).toHaveLength(1);
      expect(ing.requests).toHaveLength(1);
      expect(idn.requests[0].url).toBe('/api/users/me/limits');
      expect(ing.requests[0].url).toBe('/api/uploads');
      for (const r of [...idn.requests, ...ing.requests]) {
        expect(r.method).toBe('GET');
        expect(r.headers.authorization).toBe(AUTH);
        for (const h of ['cookie', 'x-forwarded-for', 'x-user-id']) {
          expect(r.headers[h]).toBeUndefined();
        }
        expect(JSON.stringify(r)).not.toContain(USER_ID);
        expect(JSON.stringify(r)).not.toContain('OTRO-ID');
      }
    });

    it('un ?userId= o ?tier=paid del cliente se ignora: sigue mandando el tier de identity (free)', async () => {
      idn.respond(200, limitsBody('free'));
      ing.respond(200, listBody(sixUploads()));
      const res = await request(app())
        .get('/api/trends?userId=OTRO&tier=paid')
        .set('Authorization', AUTH);
      expect(res.body.data.tier).toBe('free');
      expect(res.body.data.categories[0].status).toBe('locked');
    });

    it('una redireccion 3xx de identity es error de upstream (502) y no se sigue; sin llamar a ingestion', async () => {
      const other = await startFakeIngestion();
      try {
        other.respond(200, limitsBody('paid'));
        idn.respond(302, '', 0, { Location: `${other.url}/api/users/me/limits` });
        const res = await get();
        expect(res.status).toBe(502);
        expect(other.requests).toHaveLength(0);
        expect(ing.requests).toHaveLength(0);
        expect(res.body.data).toBeNull();
      } finally {
        await other.close();
      }
    });

    it('una redireccion 3xx de ingestion con tier paid es 502 y no se sigue', async () => {
      const other = await startFakeIngestion();
      try {
        idn.respond(200, limitsBody('paid'));
        ing.respond(302, '', 0, { Location: `${other.url}/api/uploads` });
        const res = await get();
        expect(res.status).toBe(502);
        expect(other.requests).toHaveLength(0);
      } finally {
        await other.close();
      }
    });
  });

  describe('fallos de identity: sin datos y sin llamar a ingestion', () => {
    function expectNoData(body: Record<string, unknown>): void {
      expect(body.data).toBeNull();
      const raw = JSON.stringify(body);
      expect(raw).not.toContain('tier');
      expect(raw).not.toContain('categories');
      expect(raw).not.toContain('locked');
      expect(ing.requests).toHaveLength(0);
    }

    it('identity 401 -> 401 unauthenticated, sin datos y contador de ingestion 0', async () => {
      idn.respond(401, '{}');
      const res = await get();
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ data: null, error: 'unauthenticated', status: 401 });
      expectNoData(res.body);
    });

    it('identity lento (timeout) -> 504 Upstream timeout, sin datos', async () => {
      idn.respond(200, limitsBody('paid'), 600);
      const res = await get(app({ timeoutMs: 50 }));
      expect(res.status).toBe(504);
      expect(res.body).toEqual({ data: null, error: 'Upstream timeout', status: 504 });
      expectNoData(res.body);
    });

    it.each([500, 503])('identity %i -> 502 Upstream unavailable, sin datos', async (status) => {
      idn.respond(status, '{}');
      const res = await get();
      expect(res.status).toBe(502);
      expect(res.body).toEqual({ data: null, error: 'Upstream unavailable', status: 502 });
      expectNoData(res.body);
    });

    it('identity con conexion rechazada -> 502, sin datos', async () => {
      const res = await get(app({ identityUrl: await closedPortUrl() }));
      expect(res.status).toBe(502);
      expect(res.body).toEqual({ data: null, error: 'Upstream unavailable', status: 502 });
      expectNoData(res.body);
    });

    it('identity con cuerpo no JSON -> 502 Bad upstream response, sin datos', async () => {
      idn.respond(200, 'no json');
      const res = await get();
      expect(res.status).toBe(502);
      expect(res.body).toEqual({ data: null, error: 'Bad upstream response', status: 502 });
      expectNoData(res.body);
    });

    it('identity con cuerpo que no valida LimitsResponseSchema -> 502, sin datos', async () => {
      idn.respond(200, JSON.stringify({ data: { tier: 'free' }, error: null, status: 200 }));
      const res = await get();
      expect(res.status).toBe(502);
      expectNoData(res.body);
    });

    it('identity con tier desconocido -> 502 y nunca se asume free ni paid', async () => {
      idn.respond(200, limitsBody('enterprise'));
      const res = await get();
      expect(res.status).toBe(502);
      expectNoData(res.body);
    });
  });

  describe('fallos de ingestion con tier paid: mismos codigos que /api/trends/history', () => {
    beforeEach(() => idn.respond(200, limitsBody('paid')));

    function expectNoPartial(body: Record<string, unknown>): void {
      expect(body.data).toBeNull();
      expect(JSON.stringify(body)).not.toContain('categories');
    }

    it('ingestion 401 -> 401 unauthenticated', async () => {
      ing.respond(401, '{}');
      const res = await get();
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ data: null, error: 'unauthenticated', status: 401 });
      expectNoPartial(res.body);
    });

    it.each([500, 503])('ingestion %i -> 502 Upstream unavailable', async (status) => {
      ing.respond(status, '{}');
      const res = await get();
      expect(res.status).toBe(502);
      expect(res.body).toEqual({ data: null, error: 'Upstream unavailable', status: 502 });
      expectNoPartial(res.body);
    });

    it('ingestion con conexion rechazada -> 502', async () => {
      const res = await get(app({ ingestionUrl: await closedPortUrl() }));
      expect(res.status).toBe(502);
      expectNoPartial(res.body);
    });

    it('ingestion lento (timeout) -> 504', async () => {
      ing.respond(200, listBody([]), 600);
      const res = await get(app({ timeoutMs: 100 }));
      // identity responde al instante; el timeout aplica a ingestion
      expect(res.status).toBe(504);
      expect(res.body).toEqual({ data: null, error: 'Upstream timeout', status: 504 });
      expectNoPartial(res.body);
    });

    it('ingestion con cuerpo invalido -> 502 Bad upstream response', async () => {
      ing.respond(200, JSON.stringify({ data: { items: 'x' }, error: null, status: 200 }));
      const res = await get();
      expect(res.status).toBe(502);
      expect(res.body).toEqual({ data: null, error: 'Bad upstream response', status: 502 });
      expectNoPartial(res.body);
    });
  });

  describe('autenticacion: sin JWT valido no se llama a nadie', () => {
    it('sin token -> 401 y contadores en 0 (no llama a identity ni a ingestion)', async () => {
      const res = await request(app()).get('/api/trends');
      expect(res.status).toBe(401);
      expect(idn.requests).toHaveLength(0);
      expect(ing.requests).toHaveLength(0);
    });

    it('token basura -> 401 y contadores en 0 (no llama a identity ni a ingestion)', async () => {
      const res = await request(app()).get('/api/trends').set('Authorization', 'Bearer basura');
      expect(res.status).toBe(401);
      expect(idn.requests).toHaveLength(0);
      expect(ing.requests).toHaveLength(0);
    });

    it('token firmado con otro secreto -> 401 y contadores en 0', async () => {
      const bad = makeJwt(USER_ID, {});
      const res = await request(app())
        .get('/api/trends')
        .set('Authorization', `Bearer ${bad.slice(0, -3)}abc`);
      expect(res.status).toBe(401);
      expect(idn.requests).toHaveLength(0);
      expect(ing.requests).toHaveLength(0);
    });
  });

  describe('silencio de logs (sin credenciales, ids ni datos de tendencia)', () => {
    /** Scores reconocibles: no chocan con ids, timestamps ni otros numeros del cuerpo. */
    const MARKED = [71, 83, 97];
    function markedUploads(): Record<string, unknown>[] {
      return [...MARKED, ...MARKED]
        .map((score, i) => ({
          uploadId: uid(i + 1),
          status: 'ready',
          confidence: 'HIGH',
          timestamp: ts(i + 1),
          scores: [{ categoryId: 'CAT-1', score }],
        }))
        .reverse();
    }

    function expectSilentLogs(): void {
      const text = logged();
      for (const secret of [
        JWT,
        AUTH,
        'Bearer',
        'bearer',
        USER_ID,
        'improving',
        'stagnating',
        'worsening',
        ...[1, 2, 3, 4, 5, 6].map(uid),
      ]) {
        expect(text).not.toContain(secret);
      }
      // ni la clave ni los valores de score del historial (71, 83, 97 y los 10..60 de sixUploads)
      expect(text).not.toContain('"score"');
      for (const n of [...MARKED, 10, 20, 30, 40, 50, 60]) {
        expect(text).not.toMatch(new RegExp(`(^|\\D)${n}(\\D|$)`));
      }
    }

    it.each(['free', 'paid'])('camino feliz (%s): ningun log con datos', async (tier) => {
      idn.respond(200, limitsBody(tier));
      ing.respond(200, listBody(markedUploads()));
      const res = await get();
      expect(res.status).toBe(200);
      expectSilentLogs();
    });

    it('el camino feliz paid con scores reconocibles si devuelve esos valores (el fixture es util)', async () => {
      idn.respond(200, limitsBody('paid'));
      ing.respond(200, listBody(markedUploads()));
      const res = await get();
      expect(JSON.stringify(res.body)).toContain('97');
    });

    const failures: Array<[string, () => Promise<unknown>]> = [
      [
        'identity 401',
        async () => {
          idn.respond(401, '{}');
          return get();
        },
      ],
      [
        'identity timeout',
        async () => {
          idn.respond(200, limitsBody('paid'), 300);
          return get(app({ timeoutMs: 100 }));
        },
      ],
      [
        'identity 5xx',
        async () => {
          idn.respond(500, '{}');
          return get();
        },
      ],
      ['identity conexion rechazada', async () => get(app({ identityUrl: await closedPortUrl() }))],
      [
        'identity redireccion',
        async () => {
          idn.respond(302, '', 0, { Location: `${ing.url}/api/users/me/limits` });
          return get();
        },
      ],
      [
        'identity cuerpo no JSON',
        async () => {
          idn.respond(200, 'no json');
          return get();
        },
      ],
      [
        'identity cuerpo que no valida LimitsResponseSchema',
        async () => {
          idn.respond(200, JSON.stringify({ data: { tier: 'paid', uploadsRemaining: 'x' } }));
          return get();
        },
      ],
      [
        'identity tier desconocido',
        async () => {
          idn.respond(200, limitsBody('enterprise'));
          return get();
        },
      ],
      [
        'ingestion 401',
        async () => {
          idn.respond(200, limitsBody('paid'));
          ing.respond(401, '{}');
          return get();
        },
      ],
      [
        'ingestion 5xx',
        async () => {
          idn.respond(200, limitsBody('paid'));
          ing.respond(503, '{}');
          return get();
        },
      ],
      [
        'ingestion red (conexion rechazada)',
        async () => {
          idn.respond(200, limitsBody('paid'));
          return get(app({ ingestionUrl: await closedPortUrl() }));
        },
      ],
      [
        'ingestion timeout',
        async () => {
          idn.respond(200, limitsBody('paid'));
          ing.respond(200, listBody(markedUploads()), 600);
          return get(app({ timeoutMs: 100 }));
        },
      ],
      [
        'ingestion cuerpo invalido',
        async () => {
          idn.respond(200, limitsBody('paid'));
          ing.respond(200, 'no json');
          return get();
        },
      ],
    ];

    it.each(failures)('fallo %s: ningun log con credenciales ni datos', async (_name, run) => {
      await run();
      expectSilentLogs();
    });
  });
});
