import { fireEvent, render, screen } from '@testing-library/react';
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

export const UPLOAD_ID = '3f2b1c4e-5a6d-4e8f-9a0b-1c2d3e4f5a6b';

export const CATEGORIES = [
  {
    categoryId: 'CAT-1',
    categoryName: 'Composition',
    score: 72,
    feedback: 'Your focal point is well-placed.',
  },
  {
    categoryId: 'CAT-2',
    categoryName: 'Proportions',
    score: 58,
    feedback: 'The torso appears compressed.',
  },
  {
    categoryId: 'CAT-3',
    categoryName: 'Line Quality',
    score: 81,
    feedback: 'Confident strokes overall.',
  },
  {
    categoryId: 'CAT-4',
    categoryName: 'Values (Shading)',
    score: 64,
    feedback: 'Value range is narrow.',
  },
  {
    categoryId: 'CAT-5',
    categoryName: 'Perspective',
    score: 77,
    feedback: 'The chair legs converge too quickly.',
  },
];

export const THUMBNAIL = `/api/uploads/${UPLOAD_ID}/thumbnail?exp=1790000000&sig=abc123`;

export function limitsData(over: Record<string, unknown> = {}) {
  return {
    tier: 'free',
    uploadsRemaining: 7,
    uploadsLimit: 10,
    resetDate: '2026-10-01',
    ...over,
  };
}

export function limitsOk(over: Record<string, unknown> = {}) {
  return jsonResponse(200, { data: limitsData(over), error: null, status: 200 });
}

export function detailOk(over: Record<string, unknown> = {}) {
  return jsonResponse(200, {
    data: {
      uploadId: UPLOAD_ID,
      status: 'ready',
      confidence: 'HIGH',
      categories: CATEGORIES,
      timestamp: '2026-09-24T15:30:00.000Z',
      thumbnailUrl: THUMBNAIL,
      ...over,
    },
    error: null,
    status: 200,
  });
}

export function acceptedOk(over: Record<string, unknown> = {}) {
  return jsonResponse(202, {
    data: {
      uploadId: UPLOAD_ID,
      status: 'ready',
      confidence: 'HIGH',
      categories: CATEGORIES,
      ...over,
    },
    error: null,
    status: 202,
  });
}

export function uuidN(n: number): string {
  return `3f2b1c4e-5a6d-4e8f-9a0b-${String(n).padStart(12, '0')}`;
}

export function listItem(n: number, over: Record<string, unknown> = {}) {
  return {
    uploadId: uuidN(n),
    status: 'ready',
    confidence: 'HIGH',
    timestamp: `2026-09-${String(10 + n).padStart(2, '0')}T10:00:00.000Z`,
    scores: [],
    ...over,
  };
}

export function listOk(items: unknown[]) {
  return jsonResponse(200, { data: { items }, error: null, status: 200 });
}

export function makeFile(type: string, bytes = 100, name = 'photo.jpg'): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

export const MIB = 1024 * 1024;

export type AppEntry = string | { pathname: string; state?: unknown };

/** Siembra una sesión y pinta la app con las lecturas habituales; `routes` pisa cualquiera. */
export function setupApp(path: AppEntry, routes: Record<string, Handler> = {}) {
  const token = fakeJwt();
  window.localStorage.setItem(TOKEN_KEY, token);
  const f = installFetch({
    'GET /api/onboarding': () => onboardingState(true),
    'GET /api/users/me/limits': () => limitsOk(),
    'GET /api/uploads': () => listOk([]),
    [`GET /api/uploads/${UPLOAD_ID}`]: () => detailOk(),
    ...routes,
  });
  const view = renderApp(path);
  return { f, token, view };
}

export function countOf(f: FakeFetch, key: string): number {
  return f.calls().filter((c) => c.key === key).length;
}

function LocationProbe() {
  const loc = useLocation();
  return (
    <>
      <div data-testid="location">{loc.pathname}</div>
      <div data-testid="location-search">{loc.search}</div>
      <div data-testid="location-hash">{loc.hash}</div>
      <div data-testid="location-state">{JSON.stringify(loc.state ?? null)}</div>
    </>
  );
}

const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

export function renderApp(path: AppEntry) {
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

/** Ubicación completa: pathname + search + hash (`window.location` no cambia bajo MemoryRouter). */
export function fullLocation(): string {
  const text = (id: string) => document.querySelector(`[data-testid="${id}"]`)?.textContent ?? '';
  return text('location') + text('location-search') + text('location-hash');
}

/** El nombre del archivo del usuario no sale del `File`: ni ubicación, ni DOM, ni almacenamiento. */
export function expectFileNameAbsent(name: string) {
  expect(fullLocation()).not.toContain(name);
  expect(fullLocation()).not.toContain(encodeURIComponent(name));
  expect(document.body.innerHTML).not.toContain(name);
  expect(document.title).not.toContain(name);
  expect(document.querySelector('[data-testid="location-state"]')?.textContent ?? '').not.toContain(
    name
  );
  expect(JSON.stringify({ ...window.localStorage })).not.toContain(name);
  expect(JSON.stringify({ ...window.sessionStorage })).not.toContain(name);
}

export function headersOf(init: RequestInit): Record<string, string> {
  return { ...(init.headers as Record<string, string> | undefined) };
}

beforeEach(() => {
  window.localStorage.clear();
});

// Un espía que sobrevive a un test que falla contaminaría a los siguientes.
afterEach(() => {
  jest.restoreAllMocks();
});

export const zone = () => screen.getByRole('group', { name: 'Drop zone for your drawing' });
export const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;

/** DataTransfer mínimo que entiende `file-selector` (necesita `items` con `kind` y `getAsFile`). */
export function dataTransferOf(files: File[]) {
  return {
    files,
    types: ['Files'],
    items: files.map((f) => ({ kind: 'file', type: f.type, getAsFile: () => f })),
  };
}

export function dropOn(target: Element, files: File[]) {
  fireEvent.drop(target, { dataTransfer: dataTransferOf(files) });
}

/** La barra lateral solo existe cuando el onboarding ya se resolvió. */
export const sidebar = () => screen.findByRole('complementary');
