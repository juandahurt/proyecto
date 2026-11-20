import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TOKEN_KEY, countOf, currentPath, jsonResponse, setupApp } from './helpers';

const mockRefresh = jest.fn();
let mockLimits: { tier: 'free' | 'paid' } | null = { tier: 'free' };

jest.mock('../lib/limits-context', () => {
  const actual = jest.requireActual('../lib/limits-context');
  return {
    ...actual,
    useLimits: () => ({ limits: mockLimits, status: 'ready', refresh: mockRefresh }),
  };
});

beforeEach(() => {
  mockRefresh.mockReset();
  mockLimits = { tier: 'free' };
});

function subscribeOk() {
  return jsonResponse(200, {
    data: { tier: 'paid', uploadsRemaining: null, uploadsLimit: null, resetDate: null },
    error: null,
    status: 200,
  });
}

describe('Upgrade — flujo de un clic, por valor', () => {
  it('muestra el botón, un clic lo deshabilita, llama una vez a subscribe y refresca limits', async () => {
    const user = userEvent.setup();
    let release: (r: ReturnType<typeof jsonResponse>) => void = () => undefined;
    const pending = new Promise<ReturnType<typeof jsonResponse>>((r) => (release = r));
    const { f } = setupApp('/upgrade', { 'POST /api/users/me/subscribe': () => pending });
    const button = await screen.findByRole('button', { name: 'Upgrade to Paid' });
    await user.click(button);
    expect(screen.getByRole('button', { name: 'Upgrading…' })).toBeDisabled();
    release(subscribeOk());
    expect(await screen.findByText("You're now on the Paid plan!")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue' })).toHaveAttribute('href', '/upload');
    expect(countOf(f, 'POST /api/users/me/subscribe')).toBe(1);
    expect(mockRefresh).toHaveBeenCalledWith({ fresh: true });
  });

  it('con tier ya paid: no aparece el botón, muestra el mensaje de plan actual', async () => {
    mockLimits = { tier: 'paid' };
    setupApp('/upgrade', {});
    expect(await screen.findByText("You're already on the Paid plan.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upgrade to Paid' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to upload' })).toHaveAttribute('href', '/upload');
  });

  it('error 5xx: mensaje en role=alert, botón disponible de nuevo', async () => {
    const user = userEvent.setup();
    setupApp('/upgrade', {
      'POST /api/users/me/subscribe': () => jsonResponse(500, {}),
    });
    const button = await screen.findByRole('button', { name: 'Upgrade to Paid' });
    await user.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Upgrade failed — please try again.'
    );
    expect(screen.getByRole('button', { name: 'Upgrade to Paid' })).not.toBeDisabled();
    expect(mockRefresh).not.toHaveBeenCalledWith({ fresh: true });
  });

  it('error de red: mismo mensaje', async () => {
    const user = userEvent.setup();
    setupApp('/upgrade', {
      'POST /api/users/me/subscribe': () => {
        throw new Error('network down');
      },
    });
    const button = await screen.findByRole('button', { name: 'Upgrade to Paid' });
    await user.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Upgrade failed — please try again.'
    );
  });

  it('401 cierra sesión', async () => {
    setupApp('/upgrade', {
      'POST /api/users/me/subscribe': () =>
        jsonResponse(401, { data: null, error: 'x', status: 401 }),
    });
    const button = await screen.findByRole('button', { name: 'Upgrade to Paid' });
    await userEvent.setup().click(button);
    await waitFor(() => expect(currentPath()).toBe('/login'));
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('doble clic durante la petición en vuelo: una sola llamada a fetch', async () => {
    const user = userEvent.setup();
    let release: (r: ReturnType<typeof jsonResponse>) => void = () => undefined;
    const pending = new Promise<ReturnType<typeof jsonResponse>>((r) => (release = r));
    const { f } = setupApp('/upgrade', { 'POST /api/users/me/subscribe': () => pending });
    const button = await screen.findByRole('button', { name: 'Upgrade to Paid' });
    await user.click(button);
    await user.click(screen.getByRole('button', { name: 'Upgrading…' }));
    release(subscribeOk());
    await screen.findByText("You're now on the Paid plan!");
    expect(countOf(f, 'POST /api/users/me/subscribe')).toBe(1);
  });
});
