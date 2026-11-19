import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  TOKEN_KEY,
  UPLOAD_ID,
  countOf,
  currentPath,
  detailOk,
  jsonResponse,
  setupApp,
} from './helpers';

const KEY = `GET /api/uploads/${UPLOAD_ID}`;
const NOT_FOUND = "We couldn't find that critique.";
const LOAD_FAILED = 'We could not load this critique. Please try again.';

describe('Critique: errores de carga', () => {
  it.each([404, 403])('un %i muestra el mismo mensaje con enlace a /upload', async (status) => {
    setupApp(`/uploads/${UPLOAD_ID}`, {
      [KEY]: () => jsonResponse(status, { data: null, error: 'x', status }),
    });
    expect(await screen.findByText(NOT_FOUND)).toBeInTheDocument();
    const links = screen.getAllByRole('link').filter((l) => l.getAttribute('href') === '/upload');
    expect(links.length).toBeGreaterThanOrEqual(2); // barra lateral + enlace del mensaje
    expect(screen.queryByText(LOAD_FAILED)).toBeNull();
  });

  it.each([
    ['5xx', () => jsonResponse(500, {})],
    [
      'red',
      () => {
        throw new TypeError('network');
      },
    ],
  ])('%s muestra el mensaje con Retry que vuelve a pedir', async (_n, fail) => {
    let n = 0;
    const { f } = setupApp(`/uploads/${UPLOAD_ID}`, {
      [KEY]: () => (n++ === 0 ? (fail() as never) : detailOk()),
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(LOAD_FAILED);
    expect(countOf(f, KEY)).toBe(1);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Sep 24, 2026')).toBeInTheDocument();
    expect(countOf(f, KEY)).toBe(2);
    expect(screen.queryByText(LOAD_FAILED)).toBeNull();
  });

  it('un 200 con forma inválida se trata como error del servidor', async () => {
    setupApp(`/uploads/${UPLOAD_ID}`, { [KEY]: () => detailOk({ timestamp: 'ayer' }) });
    expect(await screen.findByRole('alert')).toHaveTextContent(LOAD_FAILED);
  });

  it('un 401 cierra la sesión', async () => {
    setupApp(`/uploads/${UPLOAD_ID}`, { [KEY]: () => jsonResponse(401, {}) });
    await waitFor(() => expect(currentPath()).toBe('/login'));
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('mientras carga hay un estado role=status y no la crítica vacía', async () => {
    let release: (r: ReturnType<typeof detailOk>) => void = () => undefined;
    const pending = new Promise<ReturnType<typeof detailOk>>((r) => (release = r));
    setupApp(`/uploads/${UPLOAD_ID}`, { [KEY]: () => pending as never });
    expect(await screen.findByRole('status')).toHaveTextContent(/Loading/);
    expect(screen.queryByRole('heading', { name: 'AI Critique' })).toBeNull();
    expect(screen.queryByText(NOT_FOUND)).toBeNull();
    release(detailOk());
    expect(await screen.findByText('Sep 24, 2026')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it.each(['no-es-uuid', '123', '3f2b1c4e-5a6d-4e8f-9a0b'])(
    'un uploadId %j que no es UUID no hace fetch y muestra no encontrado',
    async (id) => {
      const { f } = setupApp(`/uploads/${id}`);
      expect(await screen.findByText(NOT_FOUND)).toBeInTheDocument();
      expect(f.calls().filter((c) => c.url.startsWith('/api/uploads/'))).toHaveLength(0);
      expect(screen.queryByText('Page not found')).toBeNull();
    }
  );
});
