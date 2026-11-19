import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  TOKEN_KEY,
  currentPath,
  fakeJwt,
  installFetch,
  jsonResponse,
  onboardingState,
  renderApp,
} from './helpers';

const seed = () => window.localStorage.setItem(TOKEN_KEY, fakeJwt());

const failures: Array<[string, () => ReturnType<typeof jsonResponse>]> = [
  ['5xx', () => jsonResponse(500, { data: null, error: 'x', status: 500 })],
  [
    'red',
    () => {
      throw new TypeError('network');
    },
  ],
];

describe('guarda: pantalla de error al consultar el onboarding (C-68)', () => {
  it.each(failures)('con %s ofrece Retry y Log out', async (_name, fail) => {
    seed();
    installFetch({ 'GET /api/onboarding': fail });
    renderApp('/upload');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('We could not load your account status');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeEnabled();
  });

  it.each(failures)(
    'con %s «Log out» borra el token, termina en /login y no llama más a la API',
    async (_name, fail) => {
      seed();
      const f = installFetch({ 'GET /api/onboarding': fail });
      renderApp('/upload');
      await screen.findByRole('alert');
      expect(f.count()).toBe(1);
      await userEvent.setup().click(screen.getByRole('button', { name: 'Log out' }));
      await waitFor(() => expect(currentPath()).toBe('/login'));
      expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(f.count()).toBe(1);
    }
  );

  it('«Retry» vuelve a consultar el onboarding', async () => {
    seed();
    let n = 0;
    const f = installFetch({
      'GET /api/onboarding': () => (n++ === 0 ? jsonResponse(500, {}) : onboardingState(true)),
    });
    renderApp('/upload');
    await screen.findByRole('alert');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(f.calls().filter((c) => c.key === 'GET /api/onboarding')).toHaveLength(2)
    );
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('la pantalla de error también aparece en /onboarding con Log out', async () => {
    seed();
    installFetch({ 'GET /api/onboarding': () => jsonResponse(500, {}) });
    renderApp('/onboarding');
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });
});
