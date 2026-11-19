import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ONBOARDING_CHECKBOXES } from '@proyecto/shared-types';
import {
  TOKEN_KEY,
  currentPath,
  fakeJwt,
  headersOf,
  installFetch,
  jsonResponse,
  onboardingState,
  renderApp,
  spyConsole,
} from './helpers';

function seedSession() {
  const token = fakeJwt();
  window.localStorage.setItem(TOKEN_KEY, token);
  return token;
}

async function openOnboarding(
  post: () => ReturnType<typeof jsonResponse> = () => jsonResponse(204)
) {
  const token = seedSession();
  const f = installFetch({
    'GET /api/onboarding': () => onboardingState(false),
    'POST /api/onboarding': post,
  });
  renderApp('/onboarding');
  await screen.findByRole('heading', { level: 1 });
  return { token, f };
}

const startButton = () => screen.getByRole('button', { name: 'Get Started' });

describe('Onboarding', () => {
  it('renderiza 3 checkboxes con la etiqueta byte a byte igual a ONBOARDING_CHECKBOXES', async () => {
    await openOnboarding();
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(3);
    expect(ONBOARDING_CHECKBOXES).toHaveLength(3);
    ONBOARDING_CHECKBOXES.forEach((text, i) => {
      expect(screen.getByLabelText(text)).toBe(boxes[i]);
      expect(document.querySelector(`label[for="${boxes[i].id}"]`)!.textContent).toBe(text);
    });
  });

  it.each([0, 1, 2])(
    'con %i marcados Get Started está disabled y aria-disabled=true',
    async (n) => {
      await openOnboarding();
      const user = userEvent.setup();
      const boxes = screen.getAllByRole('checkbox');
      for (let i = 0; i < n; i++) await user.click(boxes[i]);
      expect(startButton()).toBeDisabled();
      expect(startButton()).toHaveAttribute('aria-disabled', 'true');
    }
  );

  it('con los 3 marcados el botón está activo', async () => {
    await openOnboarding();
    const user = userEvent.setup();
    for (const b of screen.getAllByRole('checkbox')) await user.click(b);
    expect(startButton()).toBeEnabled();
    expect(startButton()).toHaveAttribute('aria-disabled', 'false');
  });

  it('marcar y desmarcar vuelve a deshabilitar el botón', async () => {
    await openOnboarding();
    const user = userEvent.setup();
    const boxes = screen.getAllByRole('checkbox');
    for (const b of boxes) await user.click(b);
    expect(startButton()).toBeEnabled();
    await user.click(boxes[1]);
    expect(startButton()).toBeDisabled();
    await user.click(boxes[1]);
    expect(startButton()).toBeEnabled();
  });

  it('al pulsar envía POST /api/onboarding con los tres true y Authorization, y con 204 navega a /upload', async () => {
    const { token, f } = await openOnboarding(() => jsonResponse(204));
    const user = userEvent.setup();
    for (const b of screen.getAllByRole('checkbox')) await user.click(b);
    await user.click(startButton());
    await waitFor(() => expect(currentPath()).toBe('/upload'));
    const post = f.calls().find((c) => c.key === 'POST /api/onboarding')!;
    expect(JSON.parse(post.init.body as string)).toEqual({
      checkbox1: true,
      checkbox2: true,
      checkbox3: true,
    });
    expect(headersOf(post.init).Authorization).toBe(`Bearer ${token}`);
    expect(f.calls().filter((c) => c.key === 'POST /api/onboarding')).toHaveLength(1);
  });

  it('el 200 con envoltorio que devuelve hoy el servicio trust también navega a /upload', async () => {
    await openOnboarding(() =>
      jsonResponse(200, { data: { acknowledged: true }, error: null, status: 200 })
    );
    const user = userEvent.setup();
    for (const b of screen.getAllByRole('checkbox')) await user.click(b);
    await user.click(startButton());
    await waitFor(() => expect(currentPath()).toBe('/upload'));
  });

  it('tras completar el onboarding no se vuelve a pedir ni a mostrar al ir a /onboarding', async () => {
    const { f } = await openOnboarding();
    const user = userEvent.setup();
    for (const b of screen.getAllByRole('checkbox')) await user.click(b);
    await user.click(startButton());
    await waitFor(() => expect(currentPath()).toBe('/upload'));
    expect(f.calls().filter((c) => c.key === 'GET /api/onboarding')).toHaveLength(1);
  });

  it.each([422, 500])('un %i muestra un error en role=alert y no navega', async (status) => {
    await openOnboarding(() => jsonResponse(status, { data: null, error: 'x', status }));
    const user = userEvent.setup();
    for (const b of screen.getAllByRole('checkbox')) await user.click(b);
    await user.click(startButton());
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(currentPath()).toBe('/onboarding');
    expect(startButton()).toBeEnabled();
  });

  it('un error de red muestra un error y no navega', async () => {
    await openOnboarding(() => {
      throw new TypeError('x');
    });
    const user = userEvent.setup();
    for (const b of screen.getAllByRole('checkbox')) await user.click(b);
    await user.click(startButton());
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(currentPath()).toBe('/onboarding');
  });

  it('un 401 al enviar borra el token y vuelve a /login', async () => {
    await openOnboarding(() => jsonResponse(401, { data: null, error: 'x', status: 401 }));
    const user = userEvent.setup();
    for (const b of screen.getAllByRole('checkbox')) await user.click(b);
    await user.click(startButton());
    await waitFor(() => expect(currentPath()).toBe('/login'));
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('no escribe en la consola ni expone el token', async () => {
    const spy = spyConsole();
    const { token } = await openOnboarding(() => jsonResponse(422, {}));
    const user = userEvent.setup();
    for (const b of screen.getAllByRole('checkbox')) await user.click(b);
    await user.click(startButton());
    await screen.findByRole('alert');
    expect(spy.callCount()).toBe(0);
    expect(spy.allArgs().join(' ')).not.toContain(token);
    spy.restore();
  });
});

describe('Onboarding: silencio de consola en cada rama de error', () => {
  const cases: Array<[string, () => ReturnType<typeof jsonResponse>]> = [
    ['422', () => jsonResponse(422, { data: null, error: 'x', status: 422 })],
    ['5xx', () => jsonResponse(500, { data: null, error: 'x', status: 500 })],
    [
      'red',
      () => {
        throw new TypeError('network');
      },
    ],
  ];
  it.each(cases)('onboarding %s no escribe nada en la consola', async (_name, respond) => {
    const spy = spyConsole();
    const { token } = await openOnboarding(respond);
    const user = userEvent.setup();
    for (const b of screen.getAllByRole('checkbox')) await user.click(b);
    await user.click(startButton());
    await screen.findByRole('alert');
    expect(spy.callCount()).toBe(0);
    expect(spy.allArgs().join(' ')).not.toContain(token);
    spy.restore();
  });
});
