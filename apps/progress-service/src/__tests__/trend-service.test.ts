import { CategoryTrendCalcSchema } from '@proyecto/shared-types';
import { getTrends } from '../service/trend-service';
import {
  FakeIngestion,
  ID_1,
  closedPortUrl,
  listBody,
  lowItem,
  makeJwt,
  readyItem,
  startFakeIngestion,
} from './fake-ingestion';

const OPTIONS = { minUploads: 4, slopeImproving: 2, slopeWorsening: -2 };
const IDS = [1, 2, 3, 4, 5].map(
  (n) => `${n}${n}${n}${n}${n}${n}${n}${n}-1111-4111-8111-111111111111`
);
const TS = '2026-11-01T10:00:00.000Z';

describe('getTrends', () => {
  let fake: FakeIngestion;
  let auth: string;
  let spies: jest.SpyInstance[];

  beforeEach(async () => {
    fake = await startFakeIngestion();
    auth = `Bearer ${makeJwt()}`;
    spies = [
      jest.spyOn(console, 'log').mockImplementation(() => undefined),
      jest.spyOn(console, 'info').mockImplementation(() => undefined),
      jest.spyOn(console, 'warn').mockImplementation(() => undefined),
      jest.spyOn(console, 'error').mockImplementation(() => undefined),
      jest.spyOn(console, 'debug').mockImplementation(() => undefined),
      jest.spyOn(process.stdout, 'write').mockImplementation(() => true),
    ];
  });
  afterEach(async () => {
    spies.forEach((s) => s.mockRestore());
    await fake.close();
  });

  function run(baseUrl = fake.url, timeoutMs = 2000) {
    return getTrends({ authorization: auth, fetchFn: fetch, baseUrl, timeoutMs, options: OPTIONS });
  }
  function expectSilent(): void {
    // El silencio se comprueba sobre los espías: ninguno recibió llamadas.
    for (const s of spies) expect(s).not.toHaveBeenCalled();
  }

  it('200 con items -> las 5 categorías calculadas y válidas; silencio (camino feliz con tendencia)', async () => {
    // scores readyItem: CAT-n = n*10 constante en cada upload => stagnating con 4
    fake.respond(200, listBody(IDS.slice(0, 4).map((id) => readyItem(id, TS))));
    const r = await run();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.trends.map((t) => t.categoryId)).toEqual([
      'CAT-1',
      'CAT-2',
      'CAT-3',
      'CAT-4',
      'CAT-5',
    ]);
    for (const t of r.trends) {
      expect(t.status).toBe('stagnating');
      expect(t.slope).toBe(0);
      expect(CategoryTrendCalcSchema.safeParse(t).success).toBe(true);
    }
    expectSilent();
  });

  it('insufficient_data: silencio con menos de 4 calificados', async () => {
    fake.respond(200, listBody([readyItem(ID_1, TS), lowItem(IDS[1], TS)]));
    const r = await run();
    expect(r.ok && r.trends[0].status).toBe('insufficient_data');
    expect(r.ok && r.trends[0].uploadsNeeded).toBe(3);
    expectSilent();
  });

  it('reenvía Authorization idéntico y ningún otro header del cliente', async () => {
    fake.respond(200, listBody([]));
    await run();
    expect(fake.requests).toHaveLength(1);
    const h = fake.requests[0].headers;
    expect(h.authorization).toBe(auth);
    // Ningún header del cliente más allá de Authorization: uno por uno, por valor.
    for (const name of [
      'cookie',
      'x-forwarded-for',
      'x-user-id',
      'x-forwarded-host',
      'forwarded',
    ]) {
      expect(h[name]).toBeUndefined();
    }
    // Todo header distinto de authorization debe ser de los que pone el propio fetch (allowlist cerrada).
    const propios = new Set([
      'host',
      'connection',
      'authorization',
      'accept',
      'accept-language',
      'accept-encoding',
      'sec-fetch-mode',
      'user-agent',
    ]);
    expect(Object.keys(h).filter((k) => !propios.has(k))).toEqual([]);
    expect(fake.requests[0].url).toBe('/api/uploads');
  });

  it('listado vacío -> 5 insufficient_data', async () => {
    fake.respond(200, listBody([]));
    const r = await run();
    expect(r.ok && r.trends).toHaveLength(5);
    expect(r.ok && r.trends.every((t) => t.status === 'insufficient_data')).toBe(true);
  });

  const fallos: Array<[string, string, number]> = [
    ['401', 'unauthenticated', 401],
    ['500', 'upstream', 500],
    ['503', 'upstream', 503],
    ['redirección 302', 'upstream', 302],
  ];
  it.each(fallos)(
    'ingestion %s -> %s, sin tendencias parciales y en silencio',
    async (_n, kind, status) => {
      fake.respond(status, '{}', 0, status === 302 ? { Location: 'http://127.0.0.1:1/x' } : {});
      const r = await run();
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.kind).toBe(kind);
      expect('trends' in r).toBe(false);
      expectSilent();
    }
  );

  it('red caída -> upstream, silencio', async () => {
    const r = await run(await closedPortUrl());
    expect(r).toEqual({ ok: false, kind: 'upstream' });
    expectSilent();
  });

  it('timeout -> timeout, silencio', async () => {
    fake.respond(200, listBody([]), 400);
    const r = await run(fake.url, 50);
    expect(r).toEqual({ ok: false, kind: 'timeout' });
    expectSilent();
  });

  it('cuerpo inválido -> bad-response, silencio', async () => {
    fake.respond(200, JSON.stringify({ data: { items: [{ nope: 1 }] }, error: null, status: 200 }));
    const r = await run();
    expect(r).toEqual({ ok: false, kind: 'bad-response' });
    expectSilent();
  });
});
