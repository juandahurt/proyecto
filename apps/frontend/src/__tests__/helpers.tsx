import { render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App';

export const TEST_EMAIL = 'ana@example.test';
export const TEST_PASSWORD = 'not-a-real-password';
export const TOKEN_KEY = 'estudio.token';

function b64url(obj: unknown): string {
  return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** JWT evidentemente falso: cabecera y payload en base64url, firma literal 'fake'. */
export function fakeJwt(expOffsetSeconds = 3600): string {
  const exp = Math.floor(Date.now() / 1000) + expOffsetSeconds;
  return `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ sub: 'user-1', exp })}.fake`;
}

export interface FakeResponse {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}

export function jsonResponse(status: number, body?: unknown): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  };
}

export function authOk(status: number, token: string) {
  return jsonResponse(status, { data: { token, expiresIn: 604800 }, error: null, status });
}

export function onboardingState(completed: boolean) {
  return jsonResponse(200, { data: { completed }, error: null, status: 200 });
}

export type Handler = (init: RequestInit) => FakeResponse | Promise<FakeResponse>;

export interface FakeFetch {
  mock: jest.Mock;
  calls: () => Array<{ key: string; url: string; init: RequestInit }>;
  count: () => number;
}

/** Instala un `fetch` falso global. Cada clave es "METHOD /ruta". Una ruta sin handler lanza. */
export function installFetch(routes: Record<string, Handler>): FakeFetch {
  const mock = jest.fn(async (url: string, init: RequestInit = {}) => {
    const key = `${init.method ?? 'GET'} ${url}`;
    const handler = routes[key];
    if (!handler) throw new TypeError(`unexpected request ${key}`);
    return handler(init);
  });
  (globalThis as unknown as { fetch: unknown }).fetch = mock;
  return {
    mock,
    calls: () =>
      mock.mock.calls.map(([url, init]) => ({
        key: `${(init as RequestInit | undefined)?.method ?? 'GET'} ${url}`,
        url: url as string,
        init: (init ?? {}) as RequestInit,
      })),
    count: () => mock.mock.calls.length,
  };
}

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}</div>;
}

const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

export function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]} future={ROUTER_FUTURE}>
      <App />
      <LocationProbe />
    </MemoryRouter>
  );
}

export function currentPath(): string {
  return document.querySelector('[data-testid="location"]')?.textContent ?? '';
}

export function headersOf(init: RequestInit): Record<string, string> {
  return { ...(init.headers as Record<string, string> | undefined) };
}

export function spyConsole() {
  const methods = ['log', 'info', 'warn', 'error', 'debug'] as const;
  const spies = methods.map((m) => jest.spyOn(console, m).mockImplementation(() => undefined));
  return {
    allArgs: () => spies.flatMap((s) => s.mock.calls.flat().map((a) => String(a))),
    callCount: () => spies.reduce((n, s) => n + s.mock.calls.length, 0),
    restore: () => spies.forEach((s) => s.mockRestore()),
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

// Un espía que sobrevive a un test que falla contaminaría a los siguientes.
afterEach(() => {
  jest.restoreAllMocks();
});
