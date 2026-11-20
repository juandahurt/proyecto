import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TOKEN_KEY, countOf, currentPath, jsonResponse, setupApp } from './helpers';

const mockRefresh = jest.fn();

jest.mock('../lib/limits-context', () => {
  const actual = jest.requireActual('../lib/limits-context');
  return {
    ...actual,
    useLimits: () => ({ limits: { tier: 'free' }, status: 'ready', refresh: mockRefresh }),
  };
});

beforeEach(() => {
  mockRefresh.mockReset();
});

function deleteNoCode() {
  return jsonResponse(204);
}

describe('Settings — confirmación de dos pasos para borrar el historial (US-13)', () => {
  it('el botón Delete permanently solo se habilita con exactamente "DELETE"', async () => {
    const user = userEvent.setup();
    setupApp('/settings', {});
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete my history' }));
    expect(currentPath()).toBe('/settings');

    const input = screen.getByLabelText('Type the word DELETE to confirm');
    const confirmButton = screen.getByRole('button', { name: 'Delete permanently' });
    expect(confirmButton).toBeDisabled();

    await user.type(input, 'delete');
    expect(confirmButton).toBeDisabled();
    await user.clear(input);
    await user.type(input, 'DELETE ');
    expect(confirmButton).toBeDisabled();
    await user.clear(input);
    await user.type(input, ' DELETE');
    expect(confirmButton).toBeDisabled();
    await user.clear(input);
    await user.type(input, 'DELETE');
    expect(confirmButton).not.toBeDisabled();
  });

  it('Cancel cierra la sección sin llamar a fetch, y al reabrir el campo está vacío', async () => {
    const user = userEvent.setup();
    const { f } = setupApp('/settings', {});
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    await user.click(screen.getByRole('button', { name: 'Delete my history' }));
    await user.type(screen.getByLabelText('Type the word DELETE to confirm'), 'DELETE');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Type the word DELETE to confirm')).not.toBeInTheDocument();
    expect(countOf(f, 'DELETE /api/history')).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Delete my history' }));
    expect(
      (screen.getByLabelText('Type the word DELETE to confirm') as HTMLInputElement).value
    ).toBe('');
  });

  it('con el texto correcto: un clic deshabilita el botón, llama una vez; 204 muestra éxito y refresca limits', async () => {
    const user = userEvent.setup();
    let release: (r: ReturnType<typeof jsonResponse>) => void = () => undefined;
    const pending = new Promise<ReturnType<typeof jsonResponse>>((r) => (release = r));
    const { f } = setupApp('/settings', { 'DELETE /api/history': () => pending });
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    await user.click(screen.getByRole('button', { name: 'Delete my history' }));
    await user.type(screen.getByLabelText('Type the word DELETE to confirm'), 'DELETE');
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));
    const deletingButton = screen.getByRole('button', { name: 'Deleting…' });
    expect(deletingButton).toBeDisabled();
    await user.click(deletingButton);
    release(deleteNoCode());
    expect(await screen.findByRole('status')).toHaveTextContent('Your history has been deleted.');
    expect(screen.queryByLabelText('Type the word DELETE to confirm')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete permanently' })).not.toBeInTheDocument();
    expect(countOf(f, 'DELETE /api/history')).toBe(1);
    expect(mockRefresh).toHaveBeenCalledWith({ fresh: true });
  });

  it('error 5xx/red: mensaje en role=alert, la sección sigue visible con el campo tal como estaba', async () => {
    const user = userEvent.setup();
    setupApp('/settings', { 'DELETE /api/history': () => jsonResponse(500, {}) });
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    await user.click(screen.getByRole('button', { name: 'Delete my history' }));
    await user.type(screen.getByLabelText('Type the word DELETE to confirm'), 'DELETE');
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not delete your history — please try again.'
    );
    expect(
      (screen.getByLabelText('Type the word DELETE to confirm') as HTMLInputElement).value
    ).toBe('DELETE');
    expect(screen.getByRole('button', { name: 'Delete permanently' })).not.toBeDisabled();
  });

  it('401 cierra sesión', async () => {
    const user = userEvent.setup();
    setupApp('/settings', {
      'DELETE /api/history': () => jsonResponse(401, { data: null, error: 'x', status: 401 }),
    });
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    await user.click(screen.getByRole('button', { name: 'Delete my history' }));
    await user.type(screen.getByLabelText('Type the word DELETE to confirm'), 'DELETE');
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));
    await waitFor(() => expect(currentPath()).toBe('/login'));
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('doble clic durante la petición en vuelo: una sola llamada a fetch', async () => {
    const user = userEvent.setup();
    let release: (r: ReturnType<typeof jsonResponse>) => void = () => undefined;
    const pending = new Promise<ReturnType<typeof jsonResponse>>((r) => (release = r));
    const { f } = setupApp('/settings', { 'DELETE /api/history': () => pending });
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    await user.click(screen.getByRole('button', { name: 'Delete my history' }));
    await user.type(screen.getByLabelText('Type the word DELETE to confirm'), 'DELETE');
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));
    await user.click(screen.getByRole('button', { name: 'Deleting…' }));
    release(deleteNoCode());
    await screen.findByRole('status');
    expect(countOf(f, 'DELETE /api/history')).toBe(1);
  });
});

describe('Settings — enlace a la política de datos (AC-12.1)', () => {
  it('Settings tiene un enlace "Data Policy" que navega a /policy', async () => {
    const user = userEvent.setup();
    setupApp('/settings', {});
    const link = await screen.findByRole('link', { name: 'Data Policy' });
    expect(link).toHaveAttribute('href', '/policy');
    await user.click(link);
    await waitFor(() => expect(currentPath()).toBe('/policy'));
  });

  it('/policy pinta un h1 y "Coming soon." sin llamar a GET /api/policy', async () => {
    const { f } = setupApp('/policy', {});
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Data Policy' })
    ).toBeInTheDocument();
    expect(screen.getByText('Coming soon.')).toBeInTheDocument();
    expect(countOf(f, 'GET /api/policy')).toBe(0);
  });
});
