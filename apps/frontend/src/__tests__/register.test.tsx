import { screen, waitFor } from '@testing-library/react';
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

describe('Register', () => {
  it('con 201 guarda el token, queda con sesión iniciada y navega al onboarding', async () => {
    const token = fakeJwt();
    const f = installFetch({
      'POST /api/auth/register': () => authOk(201, token),
      'GET /api/onboarding': () => onboardingState(false),
    });
    renderApp('/register');
    const user = await fill(TEST_EMAIL, TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(currentPath()).toBe('/onboarding'));
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe(token);
    const reg = f.calls().find((c) => c.key === 'POST /api/auth/register')!;
    expect(JSON.parse(reg.init.body as string)).toEqual({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    expect(headersOf(reg.init).Authorization).toBeUndefined();
    expect(f.calls().some((c) => c.key === 'POST /api/auth/login')).toBe(false);
  });

  it('con 409 muestra An account with that email already exists en role=alert', async () => {
    installFetch({
      'POST /api/auth/register': () => jsonResponse(409, { data: null, error: 'dup', status: 409 }),
    });
    renderApp('/register');
    const user = await fill(TEST_EMAIL, TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /^An account with that email already exists$/
    );
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('una contraseña de 7 caracteres se rechaza en el cliente sin fetch', async () => {
    const f = installFetch({});
    renderApp('/register');
    const user = await fill(TEST_EMAIL, '1234567');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Password must be at least 8 characters.'
    );
    expect(f.count()).toBe(0);
  });

  it('un email inválido se rechaza en el cliente sin fetch', async () => {
    const f = installFetch({});
    renderApp('/register');
    const user = await fill('sin-arroba', TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email address.');
    expect(f.count()).toBe(0);
  });

  it('un 500 y un error de red muestran el mensaje genérico', async () => {
    installFetch({ 'POST /api/auth/register': () => jsonResponse(500, {}) });
    const first = renderApp('/register');
    let user = await fill(TEST_EMAIL, TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.'
    );
    first.unmount();
    installFetch({
      'POST /api/auth/register': () => {
        throw new TypeError('x');
      },
    });
    renderApp('/register');
    user = await fill(TEST_EMAIL, TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.'
    );
  });

  it('enlaces cruzados entre /login y /register', async () => {
    installFetch({});
    renderApp('/register');
    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: /Log in/ }));
    expect(currentPath()).toBe('/login');
    await user.click(screen.getByRole('link', { name: /Create one|Sign up|Register/ }));
    expect(currentPath()).toBe('/register');
  });

  it('la contraseña nunca aparece en la URL, en localStorage ni en la consola', async () => {
    installFetch({
      'POST /api/auth/register': () => authOk(201, fakeJwt()),
      'GET /api/onboarding': () => onboardingState(false),
    });
    renderApp('/register');
    const user = await fill(TEST_EMAIL, TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(currentPath()).toBe('/onboarding'));
    expect(currentPath()).not.toContain(TEST_PASSWORD);
    expect(window.location.href).not.toContain(TEST_PASSWORD);
    expect(JSON.stringify({ ...window.localStorage })).not.toContain(TEST_PASSWORD);
  });
});

describe('Register: silencio de consola en cada rama de error', () => {
  const cases: Array<[string, () => ReturnType<typeof jsonResponse>]> = [
    ['409', () => jsonResponse(409, { data: null, error: 'dup', status: 409 })],
    ['5xx', () => jsonResponse(500, { data: null, error: 'x', status: 500 })],
    [
      'red',
      () => {
        throw new TypeError('network');
      },
    ],
  ];
  it.each(cases)('registro %s no escribe nada en la consola', async (_name, respond) => {
    installFetch({ 'POST /api/auth/register': respond });
    renderApp('/register');
    const user = await fill(TEST_EMAIL, TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await screen.findByRole('alert');
  });
});
