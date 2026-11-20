import { fetchLimits, incrementCounter } from '../service/identity-client';

const BASE_URL = 'http://identity-test.invalid';

function okLimitsResponse(uploadsRemaining: number | null): Response {
  return new Response(
    JSON.stringify({
      data: { tier: 'free', uploadsRemaining, uploadsLimit: 10, resetDate: '2026-12-01' },
      error: null,
      status: 200,
    }),
    { status: 200 }
  );
}

describe('fetchLimits', () => {
  it('200 con uploadsRemaining numérico → { ok: true, uploadsRemaining }', async () => {
    const fetchFn = jest.fn().mockResolvedValue(okLimitsResponse(7));
    const result = await fetchLimits({
      authorization: 'Bearer abc',
      fetchFn,
      baseUrl: BASE_URL,
      timeoutMs: 1000,
    });
    expect(result).toEqual({ ok: true, uploadsRemaining: 7 });
  });

  it('200 con uploadsRemaining null (plan paid) → { ok: true, uploadsRemaining: null }', async () => {
    const fetchFn = jest.fn().mockResolvedValue(okLimitsResponse(null));
    const result = await fetchLimits({
      authorization: 'Bearer abc',
      fetchFn,
      baseUrl: BASE_URL,
      timeoutMs: 1000,
    });
    expect(result).toEqual({ ok: true, uploadsRemaining: null });
  });

  it('reenvía SOLO la cabecera Authorization, redirect error y AbortSignal.timeout', async () => {
    const fetchFn = jest.fn().mockResolvedValue(okLimitsResponse(5));
    await fetchLimits({
      authorization: 'Bearer xyz',
      fetchFn,
      baseUrl: BASE_URL,
      timeoutMs: 1234,
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/users/me/limits`);
    expect(init.method).toBe('GET');
    expect(init.redirect).toBe('error');
    expect(init.headers).toEqual({ Authorization: 'Bearer xyz' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('401 → { ok: false, kind: "unauthenticated" }', async () => {
    const fetchFn = jest.fn().mockResolvedValue(new Response(null, { status: 401 }));
    const result = await fetchLimits({
      authorization: 'Bearer bad',
      fetchFn,
      baseUrl: BASE_URL,
      timeoutMs: 1000,
    });
    expect(result).toEqual({ ok: false, kind: 'unauthenticated' });
  });

  it('timeout (AbortSignal.timeout dispara TimeoutError) → { ok: false, kind: "timeout" }', async () => {
    const timeoutError = new DOMException('The operation timed out.', 'TimeoutError');
    const fetchFn = jest.fn().mockRejectedValue(timeoutError);
    const result = await fetchLimits({
      authorization: 'Bearer abc',
      fetchFn,
      baseUrl: BASE_URL,
      timeoutMs: 1,
    });
    expect(result).toEqual({ ok: false, kind: 'timeout' });
  });

  it('red caída (fetch rechaza con error genérico) → { ok: false, kind: "upstream" }', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new TypeError('fetch failed'));
    const result = await fetchLimits({
      authorization: 'Bearer abc',
      fetchFn,
      baseUrl: BASE_URL,
      timeoutMs: 1000,
    });
    expect(result).toEqual({ ok: false, kind: 'upstream' });
  });

  it('status inesperado (500) → { ok: false, kind: "upstream", status: 500 }', async () => {
    const fetchFn = jest.fn().mockResolvedValue(new Response(null, { status: 500 }));
    const result = await fetchLimits({
      authorization: 'Bearer abc',
      fetchFn,
      baseUrl: BASE_URL,
      timeoutMs: 1000,
    });
    expect(result).toEqual({ ok: false, kind: 'upstream', status: 500 });
  });

  it('body con schema inválido (uploadsRemaining string) → { ok: false, kind: "bad-response" }', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ data: { uploadsRemaining: 'siete' }, error: null, status: 200 }),
          { status: 200 }
        )
      );
    const result = await fetchLimits({
      authorization: 'Bearer abc',
      fetchFn,
      baseUrl: BASE_URL,
      timeoutMs: 1000,
    });
    expect(result).toEqual({ ok: false, kind: 'bad-response' });
  });

  it('body no parseable como JSON → { ok: false, kind: "bad-response" }', async () => {
    const fetchFn = jest.fn().mockResolvedValue(new Response('not json', { status: 200 }));
    const result = await fetchLimits({
      authorization: 'Bearer abc',
      fetchFn,
      baseUrl: BASE_URL,
      timeoutMs: 1000,
    });
    expect(result).toEqual({ ok: false, kind: 'bad-response' });
  });
});

describe('incrementCounter', () => {
  it('200 → { ok: true }, POST a increment-counter SIN cabecera Authorization', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { count: 3 }, error: null, status: 200 }), {
        status: 200,
      })
    );
    const result = await incrementCounter({
      userId: 'user-123',
      fetchFn,
      baseUrl: BASE_URL,
      timeoutMs: 1000,
    });
    expect(result).toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/internal/users/user-123/increment-counter`);
    expect(init.method).toBe('POST');
    expect(init.headers).toBeUndefined();
  });

  it('fallo de red → { ok: false }', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new TypeError('fetch failed'));
    const result = await incrementCounter({
      userId: 'user-123',
      fetchFn,
      baseUrl: BASE_URL,
      timeoutMs: 1000,
    });
    expect(result).toEqual({ ok: false });
  });

  it('timeout → { ok: false }', async () => {
    const timeoutError = new DOMException('timeout', 'TimeoutError');
    const fetchFn = jest.fn().mockRejectedValue(timeoutError);
    const result = await incrementCounter({
      userId: 'user-123',
      fetchFn,
      baseUrl: BASE_URL,
      timeoutMs: 1,
    });
    expect(result).toEqual({ ok: false });
  });

  it('status inesperado (500) → { ok: false }', async () => {
    const fetchFn = jest.fn().mockResolvedValue(new Response(null, { status: 500 }));
    const result = await incrementCounter({
      userId: 'user-123',
      fetchFn,
      baseUrl: BASE_URL,
      timeoutMs: 1000,
    });
    expect(result).toEqual({ ok: false });
  });
});
