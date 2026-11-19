import { createApiClient } from '../api/client';
import { ackOnboarding, getOnboarding, loginRequest, registerRequest } from '../api/endpoints';
import { TEST_EMAIL, TEST_PASSWORD, authOk, fakeJwt, headersOf, jsonResponse } from './helpers';

function setup(token: string | null = null, fetchImpl?: jest.Mock) {
  const fetchFn =
    fetchImpl ?? jest.fn(async () => jsonResponse(200, { data: {}, error: null, status: 200 }));
  const onUnauthorized = jest.fn();
  const client = createApiClient({
    fetchFn: fetchFn as unknown as typeof fetch,
    getToken: () => token,
    onUnauthorized,
  });
  return { client, fetchFn, onUnauthorized };
}

describe('api-client', () => {
  it('todas las peticiones van a rutas relativas que empiezan por /api/', async () => {
    const { client, fetchFn } = setup(fakeJwt());
    await client.request('GET', '/api/onboarding');
    await client.request('POST', '/api/auth/login', { body: { a: 1 }, auth: false });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    for (const [url] of fetchFn.mock.calls) {
      expect(url).toMatch(/^\/api\//);
    }
  });

  it('rechaza rutas que no sean relativas a /api/ sin llamar a fetch', async () => {
    const { client, fetchFn } = setup();
    const a = await client.request('GET', 'http://evil.test/api/x');
    const b = await client.request('GET', '//evil.test/api/x');
    const c = await client.request('GET', '/otra');
    expect([a.kind, b.kind, c.kind]).toEqual(['network', 'network', 'network']);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('Authorization Bearer solo en llamadas autenticadas; login y registro no lo envían', async () => {
    const token = fakeJwt();
    const { client, fetchFn } = setup(token);
    await client.request('GET', '/api/onboarding');
    await client.request('POST', '/api/auth/login', { body: { x: 1 }, auth: false });
    const [, authed] = fetchFn.mock.calls[0];
    const [, anon] = fetchFn.mock.calls[1];
    expect(headersOf(authed).Authorization).toBe(`Bearer ${token}`);
    expect(headersOf(anon).Authorization).toBeUndefined();
    expect(Object.keys(headersOf(anon)).map((k) => k.toLowerCase())).not.toContain('authorization');
  });

  it('la única cabecera de credenciales es Authorization: sin cookies ni token en la URL', async () => {
    const token = fakeJwt();
    const { client, fetchFn } = setup(token);
    await client.request('GET', '/api/onboarding');
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).not.toContain(token);
    expect(url).not.toContain('?');
    expect((init as RequestInit).credentials).toBe('omit');
    const names = Object.keys(headersOf(init)).map((k) => k.toLowerCase());
    expect(
      names.filter((n) => n === 'authorization' || n === 'cookie' || n === 'x-auth-token')
    ).toEqual(['authorization']);
  });

  it('usa redirect error: un 3xx es un fallo, no se sigue', async () => {
    const { client, fetchFn } = setup(fakeJwt());
    await client.request('GET', '/api/onboarding');
    expect((fetchFn.mock.calls[0][1] as RequestInit).redirect).toBe('error');
  });

  it('un fallo de red (incluido redirect error) devuelve kind network sin lanzar', async () => {
    const { client } = setup(
      fakeJwt(),
      jest.fn(async () => {
        throw new TypeError('failed');
      })
    );
    const r = await client.request('GET', '/api/onboarding');
    expect(r).toMatchObject({ ok: false, kind: 'network', status: 0 });
  });

  it('envía el cuerpo JSON por valor con Content-Type application/json', async () => {
    const { client, fetchFn } = setup();
    await client.request('POST', '/api/auth/login', {
      body: { email: 'a', password: 'b' },
      auth: false,
    });
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"email":"a","password":"b"}');
    expect(headersOf(init)['Content-Type']).toBe('application/json');
  });

  it('un GET no envía cuerpo ni Content-Type', async () => {
    const { client, fetchFn } = setup(fakeJwt());
    await client.request('GET', '/api/onboarding');
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect(init.body).toBeUndefined();
    expect(headersOf(init)['Content-Type']).toBeUndefined();
  });

  it('un 401 autenticado llama a onUnauthorized; un 401 de login no', async () => {
    const fetch401 = jest.fn(async () =>
      jsonResponse(401, { data: null, error: 'x', status: 401 })
    );
    const a = setup(fakeJwt(), fetch401);
    const r1 = await a.client.request('GET', '/api/onboarding');
    expect(r1.kind).toBe('unauthorized');
    expect(a.onUnauthorized).toHaveBeenCalledTimes(1);
    const b = setup(null, fetch401);
    const r2 = await b.client.request('POST', '/api/auth/login', { body: {}, auth: false });
    expect(r2.kind).toBe('unauthorized');
    expect(b.onUnauthorized).not.toHaveBeenCalled();
  });

  it('clasifica 4xx, 5xx y cuerpos no JSON', async () => {
    const mk = (status: number, text: string) =>
      setup(
        null,
        jest.fn(async () => ({ ok: status < 300, status, text: async () => text }))
      ).client;
    expect(
      (await mk(409, '{"data":null,"error":"dup","status":409}').request('GET', '/api/x')).kind
    ).toBe('client');
    expect((await mk(500, 'boom').request('GET', '/api/x')).kind).toBe('server');
    expect((await mk(502, '').request('GET', '/api/x')).kind).toBe('server');
    const ok204 = await mk(204, '').request('GET', '/api/x');
    expect(ok204).toMatchObject({ ok: true, kind: 'none', data: null, status: 204 });
    const okBad = await mk(200, 'no json').request('GET', '/api/x');
    expect(okBad).toMatchObject({ ok: true, data: null });
  });

  it('el error del envoltorio llega como texto, y un error no-string se ignora', async () => {
    const withErr = setup(
      null,
      jest.fn(async () => jsonResponse(422, { data: null, error: 'bad', status: 422 }))
    );
    expect((await withErr.client.request('GET', '/api/x')).error).toBe('bad');
    const odd = setup(
      null,
      jest.fn(async () => jsonResponse(422, { error: { a: 1 } }))
    );
    expect((await odd.client.request('GET', '/api/x')).error).toBeNull();
  });

  it('usa el fetch global cuando no se inyecta uno', async () => {
    const g = jest.fn(async () => jsonResponse(200, { data: 1, error: null, status: 200 }));
    (globalThis as unknown as { fetch: unknown }).fetch = g;
    const client = createApiClient({ getToken: () => null, onUnauthorized: () => undefined });
    const r = await client.request('GET', '/api/x');
    expect(g).toHaveBeenCalledTimes(1);
    expect(r.ok).toBe(true);
  });

  describe('endpoints', () => {
    it('loginRequest y registerRequest no envían Authorization aunque haya token, y un 401 de login no llama a onUnauthorized', async () => {
      const token = fakeJwt();
      const f401 = jest.fn(async (..._args: unknown[]) =>
        jsonResponse(401, { data: null, error: 'x', status: 401 })
      );
      const a = setup(token, f401);
      await loginRequest(a.client, { email: TEST_EMAIL, password: TEST_PASSWORD });
      await registerRequest(a.client, { email: TEST_EMAIL, password: TEST_PASSWORD });
      expect(f401).toHaveBeenCalledTimes(2);
      for (const [, init] of f401.mock.calls) {
        const names = Object.keys(headersOf(init as RequestInit)).map((k) => k.toLowerCase());
        expect(names).not.toContain('authorization');
        expect(JSON.stringify(init)).not.toContain(token);
      }
      expect(a.onUnauthorized).not.toHaveBeenCalled();
    });

    it('loginRequest envía {email,password} por valor a POST /api/auth/login y devuelve el token', async () => {
      const token = fakeJwt();
      const { client, fetchFn } = setup(
        null,
        jest.fn(async () => authOk(200, token))
      );
      const out = await loginRequest(client, { email: TEST_EMAIL, password: TEST_PASSWORD });
      expect(out).toMatchObject({ ok: true, token, status: 200 });
      const [url, init] = fetchFn.mock.calls[0];
      expect(url).toBe('/api/auth/login');
      expect(JSON.parse((init as RequestInit).body as string)).toEqual({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });
    });

    it('registerRequest envía a POST /api/auth/register y acepta 201', async () => {
      const token = fakeJwt();
      const { client, fetchFn } = setup(
        null,
        jest.fn(async () => authOk(201, token))
      );
      const out = await registerRequest(client, { email: TEST_EMAIL, password: TEST_PASSWORD });
      expect(out).toMatchObject({ ok: true, token, status: 201 });
      expect(fetchFn.mock.calls[0][0]).toBe('/api/auth/register');
    });

    it('un 200 con forma inesperada no cuenta como sesión', async () => {
      const { client } = setup(
        null,
        jest.fn(async () => jsonResponse(200, { data: { token: 5 } }))
      );
      const out = await loginRequest(client, { email: TEST_EMAIL, password: TEST_PASSWORD });
      expect(out).toMatchObject({ ok: false, token: null, kind: 'server' });
    });

    it('un 401 de login conserva kind unauthorized', async () => {
      const { client } = setup(
        null,
        jest.fn(async () => jsonResponse(401, { data: null, error: 'x', status: 401 }))
      );
      const out = await loginRequest(client, { email: TEST_EMAIL, password: TEST_PASSWORD });
      expect(out).toMatchObject({ ok: false, token: null, kind: 'unauthorized', status: 401 });
    });

    it('getOnboarding entiende {data:{completed}} y la forma plana {completed}', async () => {
      const nested = setup(
        fakeJwt(),
        jest.fn(async () =>
          jsonResponse(200, { data: { completed: true }, error: null, status: 200 })
        )
      );
      expect(await getOnboarding(nested.client)).toMatchObject({ ok: true, completed: true });
      const flat = setup(
        fakeJwt(),
        jest.fn(async () => jsonResponse(200, { completed: false }))
      );
      expect(await getOnboarding(flat.client)).toMatchObject({ ok: true, completed: false });
    });

    it('getOnboarding con forma inesperada es un error de servidor', async () => {
      const odd = setup(
        fakeJwt(),
        jest.fn(async () => jsonResponse(200, { data: { completed: 'si' } }))
      );
      expect(await getOnboarding(odd.client)).toMatchObject({ ok: false, kind: 'server' });
      const net = setup(
        fakeJwt(),
        jest.fn(async () => {
          throw new TypeError('x');
        })
      );
      expect(await getOnboarding(net.client)).toMatchObject({ ok: false, kind: 'network' });
    });

    it('ackOnboarding envía los tres true a POST /api/onboarding y acepta 200 y 204', async () => {
      for (const status of [200, 204]) {
        const t = fakeJwt();
        const { client, fetchFn } = setup(
          t,
          jest.fn(async () =>
            jsonResponse(
              status,
              status === 200 ? { data: { acknowledged: true }, error: null, status } : undefined
            )
          )
        );
        const out = await ackOnboarding(client);
        expect(out).toMatchObject({ ok: true, completed: true, status });
        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe('/api/onboarding');
        expect(JSON.parse((init as RequestInit).body as string)).toEqual({
          checkbox1: true,
          checkbox2: true,
          checkbox3: true,
        });
        expect(headersOf(init as RequestInit).Authorization).toBe(`Bearer ${t}`);
      }
    });

    it('ackOnboarding con 422 devuelve error de cliente', async () => {
      const { client } = setup(
        fakeJwt(),
        jest.fn(async () => jsonResponse(422, { data: null, error: 'x', status: 422 }))
      );
      expect(await ackOnboarding(client)).toMatchObject({
        ok: false,
        completed: null,
        kind: 'client',
        status: 422,
      });
    });
  });

  describe('silencio de consola', () => {
    it('ningún camino (éxito, 401, 5xx, red) escribe en la consola', async () => {
      const token = fakeJwt();
      const responses = [
        jsonResponse(200, { data: {}, error: null, status: 200 }),
        jsonResponse(401, {}),
        jsonResponse(500, 'x'),
      ];
      let responsesSeen = 0;
      for (const r of responses) {
        const { client } = setup(
          token,
          jest.fn(async () => {
            responsesSeen++;
            return r;
          })
        );
        await client.request('GET', '/api/onboarding');
      }
      const { client } = setup(
        token,
        jest.fn(async () => {
          responsesSeen++;
          throw new TypeError('x');
        })
      );
      await client.request('GET', '/api/onboarding');
      expect(responsesSeen).toBe(4);
    });
  });
});
