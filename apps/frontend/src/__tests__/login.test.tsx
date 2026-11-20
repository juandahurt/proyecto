import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  TEST_EMAIL,
  TEST_PASSWORD,
  TOKEN_KEY,
  authOk,
  currentPath,
  fakeJwt,
  headersOf,
  installFetch,
  jsonResponse,
  onboardingState,
  renderApp,
} from './helpers';

async function fill(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), password);
  return user;
}

describe('Login', () => {
  it('con 200 guarda el token en estudio.token y navega según el onboarding', async () => {
    const token = fakeJwt();
    const f = installFetch({
      'POST /api/auth/login': () => authOk(200, token),
      'GET /api/onboarding': () => onboardingState(true),
    });
    renderApp('/login');
    const user = await fill(TEST_EMAIL, TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(currentPath()).toBe('/upload'));
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe(token);
    const login = f.calls().find((c) => c.key === 'POST /api/auth/login')!;
    expect(JSON.parse(login.init.body as string)).toEqual({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    expect(headersOf(login.init).Authorization).toBeUndefined();
  });

  it('con onboarding pendiente, tras el login aterriza en /onboarding', async () => {
    installFetch({
      'POST /api/auth/login': () => authOk(200, fakeJwt()),
      'GET /api/onboarding': () => onboardingState(false),
    });
    renderApp('/login');
    const user = await fill(TEST_EMAIL, TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(currentPath()).toBe('/onboarding'));
  });

  it('con 401 muestra exactamente Incorrect email or password en role=alert y no guarda token', async () => {
    installFetch({
      'POST /api/auth/login': () =>
        jsonResponse(401, { data: null, error: 'Invalid credentials', status: 401 }),
    });
    renderApp('/login');
    const user = await fill(TEST_EMAIL, TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/^Incorrect email or password$/);
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(currentPath()).toBe('/login');
  });

  it('el mensaje es idéntico sea cual sea el campo erróneo (email desconocido o clave mala)', async () => {
    const texts: string[] = [];
    for (const error of ['No such user', 'Wrong password']) {
      installFetch({
        'POST /api/auth/login': () => jsonResponse(401, { data: null, error, status: 401 }),
      });
      const { unmount } = renderApp('/login');
      const user = await fill(TEST_EMAIL, TEST_PASSWORD);
      await user.click(screen.getByRole('button', { name: 'Log in' }));
      texts.push((await screen.findByRole('alert')).textContent ?? '');
      unmount();
    }
    expect(texts[0]).toBe('Incorrect email or password');
    expect(texts[1]).toBe(texts[0]);
  });

  it('un email inválido se rechaza en el cliente sin llamar a fetch', async () => {
    const f = installFetch({});
    renderApp('/login');
    const user = await fill('no-es-un-email', TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email address.');
    expect(f.count()).toBe(0);
  });

  it('una contraseña de 7 caracteres se rechaza en el cliente sin llamar a fetch', async () => {
    const f = installFetch({});
    renderApp('/login');
    const user = await fill(TEST_EMAIL, '1234567');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Password must be at least 8 characters.'
    );
    expect(f.count()).toBe(0);
  });

  it('el botón queda deshabilitado mientras la petición está en vuelo (sin doble envío)', async () => {
    let release: (v: ReturnType<typeof jsonResponse>) => void = () => undefined;
    const pending = new Promise<ReturnType<typeof jsonResponse>>((r) => (release = r));
    const f = installFetch({
      'POST /api/auth/login': () => pending,
      'GET /api/onboarding': () => onboardingState(true),
    });
    renderApp('/login');
    const user = await fill(TEST_EMAIL, TEST_PASSWORD);
    const button = screen.getByRole('button', { name: /Log in|Logging in/ });
    await user.click(button);
    expect(button).toBeDisabled();
    await user.click(button);
    await user.keyboard('{Enter}');
    expect(f.calls().filter((c) => c.key === 'POST /api/auth/login')).toHaveLength(1);
    await act(async () => release(authOk(200, fakeJwt())));
    await waitFor(() => expect(currentPath()).toBe('/upload'));
  });

  it('un 500 muestra un mensaje genérico y no guarda token', async () => {
    installFetch({
      'POST /api/auth/login': () =>
        jsonResponse(500, { data: null, error: 'stack trace secreto', status: 500 }),
    });
    renderApp('/login');
    const user = await fill(TEST_EMAIL, TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong. Please try again.');
    expect(alert).not.toHaveTextContent('secreto');
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('un error de red muestra el mensaje genérico y no guarda token', async () => {
    installFetch({
      'POST /api/auth/login': () => {
        throw new TypeError('network');
      },
    });
    renderApp('/login');
    const user = await fill(TEST_EMAIL, TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.'
    );
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled();
  });

  it('tiene enlace a /register', async () => {
    installFetch({});
    renderApp('/login');
    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: /Create one|Sign up|Register/ }));
    expect(currentPath()).toBe('/register');
  });

  it('la contraseña y el email no aparecen en la URL, en localStorage ni en la consola', async () => {
    installFetch({
      'POST /api/auth/login': () => authOk(200, fakeJwt()),
      'GET /api/onboarding': () => onboardingState(true),
    });
    renderApp('/login');
    const user = await fill(TEST_EMAIL, TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(currentPath()).toBe('/upload'));
    expect(window.location.href).not.toContain(TEST_PASSWORD);
    expect(currentPath()).not.toContain(TEST_PASSWORD);
    expect(JSON.stringify({ ...window.localStorage })).not.toContain(TEST_PASSWORD);
  });
});

describe('Login: silencio de consola en cada rama de error', () => {
  const cases: Array<[string, () => ReturnType<typeof jsonResponse>]> = [
    ['401', () => jsonResponse(401, { data: null, error: 'x', status: 401 })],
    ['5xx', () => jsonResponse(500, { data: null, error: 'x', status: 500 })],
    [
      'red',
      () => {
        throw new TypeError('network');
      },
    ],
  ];
  it.each(cases)('login %s no escribe nada en la consola', async (_name, respond) => {
    installFetch({ 'POST /api/auth/login': respond });
    renderApp('/login');
    const user = await fill(TEST_EMAIL, TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    await screen.findByRole('alert');
  });
});
