import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UPLOAD_ID, currentPath, jsonResponse, limitsOk, setupApp, sidebar } from './helpers';

describe('contador de tier en la barra lateral (US-9, AC-9.1)', () => {
  it.each(['/upload', `/uploads/${UPLOAD_ID}`])(
    'free con 7 de 10 muestra el contador exacto y el enlace Upgrade en %s',
    async (path) => {
      setupApp(path, { 'GET /api/users/me/limits': () => limitsOk() });
      expect(
        await within(await sidebar()).findByText('7 of 10 uploads left this month')
      ).toBeVisible();
      expect(within(await sidebar()).getByText('Free')).toBeInTheDocument();
      expect(within(await sidebar()).getByRole('link', { name: 'Upgrade' })).toHaveAttribute(
        'href',
        '/upgrade'
      );
    }
  );

  it('paid (nulls) no muestra contador ni Upgrade y muestra la etiqueta Paid', async () => {
    setupApp('/upload', {
      'GET /api/users/me/limits': () =>
        limitsOk({ tier: 'paid', uploadsRemaining: null, uploadsLimit: null, resetDate: null }),
    });
    expect(await within(await sidebar()).findByText('Paid')).toBeInTheDocument();
    expect(within(await sidebar()).queryByText(/uploads left this month/)).toBeNull();
    expect(within(await sidebar()).queryByRole('link', { name: 'Upgrade' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Upgrade' })).toBeNull();
  });

  it('falla limits (5xx): «Upload count unavailable» y la zona sigue activa', async () => {
    setupApp('/upload', { 'GET /api/users/me/limits': () => jsonResponse(500, {}) });
    expect(
      await within(await sidebar()).findByText('Upload count unavailable')
    ).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Drop zone for your drawing' })).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).not.toBeNull();
  });

  it('falla limits (red): «Upload count unavailable» y la zona sigue activa', async () => {
    setupApp('/upload', {
      'GET /api/users/me/limits': () => {
        throw new TypeError('network');
      },
    });
    expect(
      await within(await sidebar()).findByText('Upload count unavailable')
    ).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).not.toBeNull();
  });

  it('una respuesta que no cumple LimitsResponseSchema es «no disponible»', async () => {
    setupApp('/upload', { 'GET /api/users/me/limits': () => limitsOk({ tier: 'gold' }) });
    expect(
      await within(await sidebar()).findByText('Upload count unavailable')
    ).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).not.toBeNull();
  });
});

describe('estado en 0 (US-9, AC-9.2, pantalla 2B)', () => {
  const zero = () =>
    setupApp('/upload', {
      'GET /api/users/me/limits': () => limitsOk({ uploadsRemaining: 0, resetDate: '2026-10-01' }),
    });

  it('no hay zona de arrastre ni input file; sí el aviso con la fecha de reinicio', async () => {
    zero();
    expect(
      await screen.findByText(
        "You've used all 10 uploads for this month. Resets on October 1 (UTC)."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Drop zone for your drawing' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Browse file' })).toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(
      within(await sidebar()).getByText('0 of 10 uploads left this month')
    ).toBeInTheDocument();
  });

  it('la fecha no lleva cero a la izquierda ni depende de la zona horaria', async () => {
    setupApp('/upload', {
      'GET /api/users/me/limits': () => limitsOk({ uploadsRemaining: 0, resetDate: '2026-11-01' }),
    });
    expect(await screen.findByText(/Resets on November 1 \(UTC\)\./)).toBeInTheDocument();
  });

  it('la región es aria-live=polite y el foco no se mueve a ella', async () => {
    zero();
    const text = await screen.findByText(/You've used all 10 uploads/);
    const region = text.closest('[aria-live]') as HTMLElement;
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).not.toContainElement(document.activeElement as HTMLElement);
    expect(document.activeElement).toBe(document.body);
  });

  it('«Upgrade for unlimited uploads» navega a /upgrade', async () => {
    zero();
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Upgrade for unlimited uploads' }));
    await waitFor(() => expect(currentPath()).toBe('/upgrade'));
  });
});
