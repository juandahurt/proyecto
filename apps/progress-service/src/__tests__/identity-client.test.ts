import { fetchLimits } from '../service/identity-client';
import { closedPortUrl, startFakeIngestion } from './fake-ingestion';
import { FakeIdentity, limitsBody, startFakeIdentity } from './fake-identity';

describe('fetchLimits', () => {
  let fake: FakeIdentity;
  beforeEach(async () => {
    fake = await startFakeIdentity();
  });
  afterEach(async () => {
    await fake.close();
  });

  const AUTH = 'Bearer token-de-prueba';
  const call = (baseUrl: string, timeoutMs = 2000, fetchFn: typeof fetch = fetch) =>
    fetchLimits({ authorization: AUTH, fetchFn, baseUrl, timeoutMs });

  it('200 valido: devuelve el tier free', async () => {
    fake.respond(200, limitsBody('free'));
    await expect(call(fake.url)).resolves.toEqual({ ok: true, tier: 'free' });
  });

  it('200 valido: devuelve el tier paid', async () => {
    fake.respond(200, limitsBody('paid'));
    await expect(call(fake.url)).resolves.toEqual({ ok: true, tier: 'paid' });
  });

  it('401 -> unauthenticated', async () => {
    fake.respond(401, '{}');
    await expect(call(fake.url)).resolves.toEqual({ ok: false, kind: 'unauthenticated' });
  });

  it('500 y 503 -> upstream con status; 403 tambien', async () => {
    for (const status of [500, 503, 403]) {
      fake.respond(status, '{}');
      await expect(call(fake.url)).resolves.toEqual({ ok: false, kind: 'upstream', status });
    }
  });

  it('conexion rechazada -> upstream (sin status)', async () => {
    await expect(call(await closedPortUrl())).resolves.toEqual({ ok: false, kind: 'upstream' });
  });

  it('timeout pequeno -> timeout', async () => {
    fake.respond(200, limitsBody('paid'), 600);
    await expect(call(fake.url, 50)).resolves.toEqual({ ok: false, kind: 'timeout' });
  });

  it('cuerpo no JSON -> bad-response', async () => {
    fake.respond(200, 'no json');
    await expect(call(fake.url)).resolves.toEqual({ ok: false, kind: 'bad-response' });
  });

  it('cuerpo que no valida LimitsResponseSchema -> bad-response', async () => {
    fake.respond(200, JSON.stringify({ data: { tier: 'free' }, error: null, status: 200 }));
    await expect(call(fake.url)).resolves.toEqual({ ok: false, kind: 'bad-response' });
  });

  it('tier desconocido -> bad-response (nunca se asume free ni paid)', async () => {
    fake.respond(200, limitsBody('enterprise'));
    await expect(call(fake.url)).resolves.toEqual({ ok: false, kind: 'bad-response' });
  });

  it('redireccion 3xx -> upstream y no hay segunda peticion (redirect: error)', async () => {
    const other = await startFakeIngestion();
    try {
      other.respond(200, limitsBody('paid'));
      fake.respond(302, '', 0, { Location: `${other.url}/api/users/me/limits` });
      const result = await call(fake.url);
      expect(result).toEqual({ ok: false, kind: 'upstream' });
      expect(other.requests).toHaveLength(0);
    } finally {
      await other.close();
    }
  });

  it('nunca lanza: fetch que lanza un valor no-Error -> upstream; TimeoutError al leer el cuerpo -> timeout', async () => {
    const throwsString = (() => Promise.reject('boom')) as unknown as typeof fetch;
    await expect(call(fake.url, 2000, throwsString)).resolves.toEqual({
      ok: false,
      kind: 'upstream',
    });
    const timeoutName = Object.assign(new Error('t'), { name: 'TimeoutError' });
    const slowBody = (() =>
      Promise.resolve({
        status: 200,
        json: () => Promise.reject(timeoutName),
      })) as unknown as typeof fetch;
    await expect(call(fake.url, 2000, slowBody)).resolves.toEqual({ ok: false, kind: 'timeout' });
  });

  it('ruta exacta GET /api/users/me/limits, sin query, y solo Authorization como cabecera del cliente', async () => {
    fake.respond(200, limitsBody('free'));
    await call(`${fake.url}/`);
    expect(fake.requests).toHaveLength(1);
    const req = fake.requests[0];
    expect(req.method).toBe('GET');
    expect(req.url).toBe('/api/users/me/limits');
    expect(req.headers.authorization).toBe(AUTH);
    for (const h of [
      'cookie',
      'x-forwarded-for',
      'x-forwarded-host',
      'x-user-id',
      'x-request-id',
    ]) {
      expect(req.headers[h]).toBeUndefined();
    }
    expect(req.body).toBe('');
  });
});
