import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TOKEN_KEY, countOf, currentPath, jsonResponse, setupApp } from './helpers';

describe('Trends — errores y carga', () => {
  it('mientras carga hay role=status, no una lista vacía', async () => {
    let release: (r: ReturnType<typeof jsonResponse>) => void = () => undefined;
    const pending = new Promise<ReturnType<typeof jsonResponse>>((r) => (release = r));
    setupApp('/trends', { 'GET /api/trends': () => pending });
    expect(screen.getByRole('status')).toBeInTheDocument();
    release(
      jsonResponse(200, { data: { tier: 'free', categories: [] }, error: null, status: 200 })
    );
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  });

  it('502/504/red dan el mismo mensaje con Retry; Retry repite la llamada', async () => {
    let n = 0;
    const { f } = setupApp('/trends', {
      'GET /api/trends': () => (n++ === 0 ? jsonResponse(502, {}) : jsonResponse(504, {})),
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not load your trends. Please try again.'
    );
    expect(countOf(f, 'GET /api/trends')).toBe(1);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(countOf(f, 'GET /api/trends')).toBe(2));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not load your trends. Please try again.'
    );
  });

  it('error de red da el mismo mensaje', async () => {
    setupApp('/trends', {
      'GET /api/trends': () => {
        throw new Error('network down');
      },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not load your trends. Please try again.'
    );
  });

  it('401 cierra sesión: token borrado, navega a /login', async () => {
    setupApp('/trends', {
      'GET /api/trends': () => jsonResponse(401, { data: null, error: 'x', status: 401 }),
    });
    await waitFor(() => expect(currentPath()).toBe('/login'));
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
