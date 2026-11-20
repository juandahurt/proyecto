import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  TOKEN_KEY,
  UPLOAD_ID,
  currentPath,
  fakeJwt,
  headersOf,
  installFetch,
  jsonResponse,
  onboardingState,
  renderApp,
} from './helpers';

const seed = () => window.localStorage.setItem(TOKEN_KEY, fakeJwt());

describe('routes y guard', () => {
  it.each([
    '/upload',
    '/onboarding',
    '/',
    '/history',
    '/settings',
    `/uploads/${UPLOAD_ID}`,
    '/upgrade',
  ])('sin token %s redirige a /login sin llamar a ninguna API', async (path) => {
    const f = installFetch({});
    renderApp(path);
    await waitFor(() => expect(currentPath()).toBe('/login'));
    expect(f.count()).toBe(0);
  });

  it('con token y completed:false, ir a /upload termina en /onboarding', async () => {
    seed();
    const f = installFetch({ 'GET /api/onboarding': () => onboardingState(false) });
    renderApp('/upload');
    await waitFor(() => expect(currentPath()).toBe('/onboarding'));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Welcome to Estudio' })
    ).toBeInTheDocument();
    expect(screen.queryByText(/Upload a Drawing/)).not.toBeInTheDocument();
    expect(headersOf(f.calls()[0].init).Authorization).toMatch(/^Bearer /);
  });

  it('con completed:true se aterriza en /upload y no se muestra el onboarding', async () => {
    seed();
    installFetch({ 'GET /api/onboarding': () => onboardingState(true) });
    renderApp('/upload');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Upload a Drawing' })
    ).toBeInTheDocument();
    expect(currentPath()).toBe('/upload');
    expect(screen.queryByText('Welcome to Estudio')).not.toBeInTheDocument();
  });

  it('/ con token y completed:true va a /upload; con false va a /onboarding', async () => {
    seed();
    installFetch({ 'GET /api/onboarding': () => onboardingState(true) });
    const a = renderApp('/');
    await waitFor(() => expect(currentPath()).toBe('/upload'));
    a.unmount();
    installFetch({ 'GET /api/onboarding': () => onboardingState(false) });
    renderApp('/');
    await waitFor(() => expect(currentPath()).toBe('/onboarding'));
  });

  it('en /onboarding con completed:true se redirige a /upload', async () => {
    seed();
    installFetch({ 'GET /api/onboarding': () => onboardingState(true) });
    renderApp('/onboarding');
    await waitFor(() => expect(currentPath()).toBe('/upload'));
    expect(screen.queryByText('Welcome to Estudio')).not.toBeInTheDocument();
  });

  it.each(['/login', '/register'])(
    'con token estando en %s se redirige según el onboarding',
    async (path) => {
      seed();
      installFetch({ 'GET /api/onboarding': () => onboardingState(false) });
      const a = renderApp(path);
      await waitFor(() => expect(currentPath()).toBe('/onboarding'));
      a.unmount();
      installFetch({ 'GET /api/onboarding': () => onboardingState(true) });
      renderApp(path);
      await waitFor(() => expect(currentPath()).toBe('/upload'));
    }
  );

  it('ruta desconocida muestra la pantalla 404, también con sesión', async () => {
    installFetch({});
    const a = renderApp('/no-existe');
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    expect(currentPath()).toBe('/no-existe');
    a.unmount();
    seed();
    installFetch({ 'GET /api/onboarding': () => onboardingState(true) });
    renderApp('/otra/cosa');
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
  });

  it('mientras se consulta el onboarding hay estado de carga y Upload no se pinta', async () => {
    seed();
    let release: (r: ReturnType<typeof jsonResponse>) => void = () => undefined;
    const pending = new Promise<ReturnType<typeof jsonResponse>>((r) => (release = r));
    installFetch({ 'GET /api/onboarding': () => pending });
    renderApp('/upload');
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    expect(screen.queryByText('Upload a Drawing')).not.toBeInTheDocument();
    expect(screen.queryByText('Welcome to Estudio')).not.toBeInTheDocument();
    release(onboardingState(true));
    expect(await screen.findByText('Upload a Drawing')).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });

  it('un 401 en GET /api/onboarding borra el token y navega a /login', async () => {
    seed();
    installFetch({
      'GET /api/onboarding': () => jsonResponse(401, { data: null, error: 'x', status: 401 }),
    });
    renderApp('/upload');
    await waitFor(() => expect(currentPath()).toBe('/login'));
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('un 500 al consultar el onboarding muestra error con Retry, sin contenido protegido', async () => {
    seed();
    let n = 0;
    installFetch({
      'GET /api/onboarding': () => (n++ === 0 ? jsonResponse(500, {}) : onboardingState(true)),
    });
    renderApp('/upload');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Upload a Drawing')).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Upload a Drawing')).toBeInTheDocument();
  });

  it('el cascarón tiene logo, enlaces Upload / My History / Settings y Log out', async () => {
    seed();
    installFetch({ 'GET /api/onboarding': () => onboardingState(true) });
    renderApp('/upload');
    await screen.findByText('Upload a Drawing');
    expect(screen.getByRole('link', { name: 'Upload' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My History' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: 'My History' }));
    expect(currentPath()).toBe('/history');
    expect(screen.getByRole('heading', { level: 1, name: 'My History' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Settings' }));
    expect(currentPath()).toBe('/settings');
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
  });

  it('Log out borra el token y navega a /login; después / no llama a la API', async () => {
    seed();
    const f = installFetch({ 'GET /api/onboarding': () => onboardingState(true) });
    renderApp('/upload');
    await screen.findByText('Upload a Drawing');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(currentPath()).toBe('/login'));
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(f.calls().filter((c) => c.key === 'GET /api/onboarding')).toHaveLength(1);
  });

  it('un token expirado en el arranque se trata como ausente: /login sin API', async () => {
    window.localStorage.setItem(TOKEN_KEY, fakeJwt(-120));
    const f = installFetch({});
    renderApp('/upload');
    await waitFor(() => expect(currentPath()).toBe('/login'));
    expect(f.count()).toBe(0);
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('un localStorage que lanza no rompe la app: se comporta como sin sesión', async () => {
    const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const f = installFetch({});
    renderApp('/upload');
    await waitFor(() => expect(currentPath()).toBe('/login'));
    expect(f.count()).toBe(0);
    spy.mockRestore();
  });
});

describe('routes nuevas (u0-T02)', () => {
  it.each([`/uploads/${UPLOAD_ID}`, '/upgrade'])(
    'con token y onboarding incompleto, %s redirige a /onboarding',
    async (path) => {
      seed();
      installFetch({ 'GET /api/onboarding': () => onboardingState(false) });
      renderApp(path);
      await waitFor(() => expect(currentPath()).toBe('/onboarding'));
    }
  );

  it('/upgrade con onboarding completo muestra un h1 y «Coming soon.» dentro de AppLayout', async () => {
    seed();
    installFetch({
      'GET /api/onboarding': () => onboardingState(true),
      'GET /api/users/me/limits': () => jsonResponse(500, {}),
    });
    renderApp('/upgrade');
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText('Coming soon.')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('/uploads/<uuid> con onboarding completo se pinta dentro de AppLayout', async () => {
    seed();
    installFetch({
      'GET /api/onboarding': () => onboardingState(true),
      'GET /api/users/me/limits': () => jsonResponse(500, {}),
      [`GET /api/uploads/${UPLOAD_ID}`]: () => jsonResponse(404, {}),
    });
    renderApp(`/uploads/${UPLOAD_ID}`);
    expect(await screen.findByText("We couldn't find that critique.")).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('un uploadId que no es UUID cae en la pantalla de la crítica, no en el 404 global', async () => {
    seed();
    installFetch({
      'GET /api/onboarding': () => onboardingState(true),
      'GET /api/users/me/limits': () => jsonResponse(500, {}),
    });
    renderApp('/uploads/no-es-uuid');
    expect(await screen.findByText("We couldn't find that critique.")).toBeInTheDocument();
    expect(screen.queryByText('Page not found')).toBeNull();
  });
});
