import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  UPLOAD_ID,
  acceptedOk,
  countOf,
  currentPath,
  dropOn,
  limitsOk,
  makeFile,
  setupApp,
} from './helpers';

describe('lectura de limits', () => {
  it('una al entrar en /upload y otra tras la subida aceptada', async () => {
    let remaining = 7;
    const { f } = setupApp('/upload', {
      'GET /api/users/me/limits': () => limitsOk({ uploadsRemaining: remaining }),
      'POST /api/uploads': () => {
        remaining = 6;
        return acceptedOk();
      },
    });
    await within(screen.getByRole('complementary')).findByText('7 of 10 uploads left this month');
    expect(countOf(f, 'GET /api/users/me/limits')).toBe(1);
    dropOn(await screen.findByRole('group', { name: 'Drop zone for your drawing' }), [
      makeFile('image/jpeg'),
    ]);
    await waitFor(() => expect(currentPath()).toBe(`/uploads/${UPLOAD_ID}`));
    await within(screen.getByRole('complementary')).findByText('6 of 10 uploads left this month');
    expect(countOf(f, 'GET /api/users/me/limits')).toBe(2);
  });

  it('entrar en /uploads/:id lee limits una sola vez para la barra lateral', async () => {
    const { f } = setupApp(`/uploads/${UPLOAD_ID}`);
    await within(screen.getByRole('complementary')).findByText('7 of 10 uploads left this month');
    expect(countOf(f, 'GET /api/users/me/limits')).toBe(1);
  });

  it('volver a /upload desde otra pantalla vuelve a leer limits', async () => {
    const { f } = setupApp(`/uploads/${UPLOAD_ID}`);
    await within(screen.getByRole('complementary')).findByText('7 of 10 uploads left this month');
    await userEvent.setup().click(screen.getByRole('link', { name: 'Upload' }));
    await waitFor(() => expect(currentPath()).toBe('/upload'));
    await waitFor(() => expect(countOf(f, 'GET /api/users/me/limits')).toBe(2));
  });
});
