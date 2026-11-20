import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { countOf, listItem, listOk, setupApp } from './helpers';

describe('History — paginación de cliente (Show all)', () => {
  it('con 12 items: pinta 10 filas iniciales y Show all 12; al activarlo pinta las 12 sin una segunda llamada a fetch', async () => {
    const items = Array.from({ length: 12 }, (_, i) => listItem(i + 1));
    const { f } = setupApp('/history', { 'GET /api/uploads': () => listOk(items) });
    await screen.findByRole('heading', { name: 'My History' });
    const rows = await screen.findAllByRole('row');
    // una fila de encabezado + 10 de datos
    expect(rows).toHaveLength(11);
    const button = screen.getByRole('button', { name: 'Show all 12' });
    expect(countOf(f, 'GET /api/uploads')).toBe(1);

    const user = userEvent.setup();
    await user.click(button);

    expect(await screen.findAllByRole('row')).toHaveLength(13);
    expect(countOf(f, 'GET /api/uploads')).toBe(1);
    expect(screen.queryByRole('button', { name: /Show all/ })).toBeNull();
  });

  it('con 10 items o menos no aparece el enlace Show all', async () => {
    const items = Array.from({ length: 10 }, (_, i) => listItem(i + 1));
    setupApp('/history', { 'GET /api/uploads': () => listOk(items) });
    await screen.findByRole('heading', { name: 'My History' });
    await screen.findAllByRole('row');
    expect(screen.queryByRole('button', { name: /Show all/ })).toBeNull();
  });
});
