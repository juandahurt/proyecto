import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ONBOARDING_CHECKBOXES } from '@proyecto/shared-types';
import {
  TOKEN_KEY,
  fakeJwt,
  installFetch,
  jsonResponse,
  onboardingState,
  renderApp,
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
