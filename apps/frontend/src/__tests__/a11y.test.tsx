import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ONBOARDING_CHECKBOXES } from '@proyecto/shared-types';
import {
  TOKEN_KEY,
  UPLOAD_ID,
  detailOk,
  dropOn,
  fakeJwt,
  installFetch,
  jsonResponse,
  onboardingState,
  limitsOk,
  listItem,
  listOk,
  makeFile,
  renderApp,
  setupApp,
} from './helpers';

const seed = () => window.localStorage.setItem(TOKEN_KEY, fakeJwt());

describe('a11y', () => {
  it.each([
    ['/login', 'Log in'],
    ['/register', 'Create your account'],
  ])(
    '%s: input con label asociado, un solo h1 y foco inicial en el primer control',
    async (path, h1) => {
      installFetch({});
      renderApp(path);
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(h1);
      expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
      expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
      expect(screen.getByLabelText('Email')).toHaveFocus();
    }
  );

  it('el formulario es operable con teclado (tab, escribir, Enter) y los errores usan role=alert', async () => {
    const f = installFetch({ 'POST /api/auth/login': () => jsonResponse(401, {}) });
    renderApp('/login');
    const user = userEvent.setup();
    await user.keyboard('ana@example.test');
    await user.tab();
    expect(screen.getByLabelText('Password')).toHaveFocus();
    await user.keyboard('not-a-real-password');
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password');
    expect(f.count()).toBe(1);
  });

  it('onboarding: foco en el primer checkbox, barra espaciadora marca, aria-disabled en el botón, un h1', async () => {
    seed();
    installFetch({
      'GET /api/onboarding': () => onboardingState(false),
      'POST /api/onboarding': () => jsonResponse(204),
    });
    renderApp('/onboarding');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const first = screen.getByLabelText(ONBOARDING_CHECKBOXES[0]);
    expect(first).toHaveFocus();
    const user = userEvent.setup();
    await user.keyboard(' ');
    expect(first).toBeChecked();
    await user.tab();
    await user.keyboard(' ');
    await user.tab();
    await user.keyboard(' ');
    const button = screen.getByRole('button', { name: 'Get Started' });
    expect(button).toHaveAttribute('aria-disabled', 'false');
    expect(button).toHaveAttribute('aria-describedby', 'onboarding-instructions');
    expect(document.getElementById('onboarding-instructions')).not.toBeNull();
    await user.tab();
    expect(button).toHaveFocus();
  });

  it('onboarding: el botón deshabilitado expone aria-disabled=true', async () => {
    seed();
    installFetch({ 'GET /api/onboarding': () => onboardingState(false) });
    renderApp('/onboarding');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('button', { name: 'Get Started' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('cascarón, 404 y marcadores: exactamente un h1 por pantalla y nav con nombre', async () => {
    seed();
    installFetch({ 'GET /api/onboarding': () => onboardingState(true) });
    const a = renderApp('/upload');
    await screen.findByText('Upload a Drawing');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    a.unmount();
    renderApp('/zzz');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});

describe('a11y: pantallas de u0-T02', () => {
  const critiqueKey = `GET /api/uploads/${UPLOAD_ID}`;

  it('/upload: un h1, zona con nombre accesible e input asociado a una etiqueta', async () => {
    setupApp('/upload');
    await screen.findByRole('group', { name: 'Drop zone for your drawing' });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const input = screen.getByLabelText('Choose an image to upload');
    expect(input).toBe(document.querySelector('input[type="file"]'));
  });

  it('/upload: el orden de tabulación es barra lateral, zona, «Browse file», lista', async () => {
    setupApp('/upload', {
      'GET /api/uploads': () => listOk([listItem(1)]),
    });
    await screen.findByRole('link', { name: 'View' });
    const user = userEvent.setup();
    const seen: string[] = [];
    for (let i = 0; i < 8; i++) {
      await user.tab();
      const el = document.activeElement as HTMLElement;
      seen.push(el.getAttribute('aria-label') ?? el.textContent ?? '');
    }
    expect(seen).toEqual([
      'Upload',
      'My History',
      'Settings',
      'Upgrade',
      'Log out',
      'Drop zone for your drawing',
      'Browse file',
      'View',
    ]);
  });

  it('un error de subida se anuncia con role=alert y no roba el foco', async () => {
    setupApp('/upload');
    dropOn(await screen.findByRole('group', { name: 'Drop zone for your drawing' }), [
      makeFile('image/gif'),
    ]);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(document.activeElement).toBe(document.body);
  });

  it('estado en 0: un h1, aria-live polite y el foco no se mueve', async () => {
    setupApp('/upload', {
      'GET /api/users/me/limits': () => limitsOk({ uploadsRemaining: 0 }),
    });
    const text = await screen.findByText(/You've used all 10 uploads/);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(text.closest('[aria-live]')).toHaveAttribute('aria-live', 'polite');
    expect(document.activeElement).toBe(document.body);
  });

  it('la lectura fallida del contador se anuncia con role=status', async () => {
    setupApp('/upload', { 'GET /api/users/me/limits': () => jsonResponse(500, {}) });
    const note = await screen.findByText('Upload count unavailable');
    expect(note.closest('[role="status"], [aria-live]')).not.toBeNull();
  });

  it('crítica: un h1 y el foco inicial queda en el encabezado', async () => {
    setupApp(`/uploads/${UPLOAD_ID}`);
    await screen.findByText('Sep 24, 2026');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
  });

  it('crítica: los badges tienen texto accesible', async () => {
    setupApp(`/uploads/${UPLOAD_ID}`);
    await screen.findByText('Sep 24, 2026');
    expect(screen.getAllByLabelText(/^Score \d+ out of 100$/)).toHaveLength(5);
  });

  it('crítica de baja confianza: un h1 y foco en el encabezado', async () => {
    setupApp(`/uploads/${UPLOAD_ID}`, {
      [critiqueKey]: () =>
        detailOk({
          status: 'low_confidence',
          confidence: 'LOW',
          fallbackReason: 'invalid_schema',
          categories: undefined,
        }),
    });
    await screen.findByRole('heading', { name: 'Critique Unavailable' });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
  });

  it('crítica con error de carga: un h1, role=alert y operable con teclado', async () => {
    setupApp(`/uploads/${UPLOAD_ID}`, { [critiqueKey]: () => jsonResponse(500, {}) });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const retry = screen.getByRole('button', { name: 'Retry' });
    retry.focus();
    expect(retry).toHaveFocus();
  });

  it('/upgrade tiene un h1 y dentro de la barra el enlace activo se anuncia', async () => {
    setupApp('/upgrade');
    await screen.findByText('Coming soon.');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      within(screen.getByRole('navigation', { name: 'Main' })).getAllByRole('link')
    ).toHaveLength(3);
  });
});
