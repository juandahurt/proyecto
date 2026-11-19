import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CATEGORIES, THUMBNAIL, UPLOAD_ID, currentPath, detailOk, setupApp } from './helpers';

const open = (over: Record<string, unknown> = {}) =>
  setupApp(`/uploads/${UPLOAD_ID}`, { [`GET /api/uploads/${UPLOAD_ID}`]: () => detailOk(over) });

describe('Critique (3A)', () => {
  it('un solo h1, la fecha en UTC y la sección «AI Critique»', async () => {
    open();
    expect(await screen.findByText('Sep 24, 2026')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'AI Critique' })).toBeInTheDocument();
  });

  it.each(['2026-09-24T00:00:30.000Z', '2026-09-24T23:59:30.000Z'])(
    'la fecha de %s es la del día UTC, no la de la zona local',
    async (timestamp) => {
      open({ timestamp });
      expect(await screen.findByText('Sep 24, 2026')).toBeInTheDocument();
    }
  );

  it('las 5 categorías salen en orden de categoryId con nombre en mayúsculas, feedback y badge', async () => {
    const shuffled = [CATEGORIES[2], CATEGORIES[4], CATEGORIES[0], CATEGORIES[3], CATEGORIES[1]];
    open({ categories: shuffled });
    await screen.findByText('Sep 24, 2026');
    const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual([
      'COMPOSITION',
      'PROPORTIONS',
      'LINE QUALITY',
      'VALUES (SHADING)',
      'PERSPECTIVE',
    ]);
    const badges = screen.getAllByLabelText(/^Score \d+ out of 100$/).map((b) => b.textContent);
    expect(badges).toEqual(['72 / 100', '58 / 100', '81 / 100', '64 / 100', '77 / 100']);
    for (const c of CATEGORIES) expect(screen.getByText(c.feedback)).toBeInTheDocument();
  });

  it('el badge lleva color por umbral y texto accesible', async () => {
    open();
    await screen.findByText('Sep 24, 2026');
    expect(screen.getByLabelText('Score 58 out of 100')).toHaveClass('bg-yellow-600');
    expect(screen.getByLabelText('Score 81 out of 100')).toHaveClass('bg-green-600');
    expect(screen.getByLabelText('Score 72 out of 100')).toHaveClass('bg-yellow-600');
  });

  it('la miniatura con ruta relativa firmada se pinta tal cual con alt descriptivo', async () => {
    open();
    const img = await screen.findByRole('img', { name: 'Uploaded drawing' });
    expect(img).toHaveAttribute('src', THUMBNAIL);
  });

  it.each(['https://example.test/x.png', 'javascript:alert(1)', '//evil.test/api/uploads/x'])(
    'thumbnailUrl %j no se pinta como <img>',
    async (url) => {
      open({ thumbnailUrl: url });
      await screen.findByText('Sep 24, 2026');
      expect(document.querySelector('img')).toBeNull();
    }
  );

  it('thumbnailUrl vacío no pinta <img> (el schema lo rechaza: error de carga, no una crítica con imagen rota)', async () => {
    open({ thumbnailUrl: '' });
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this critique');
    expect(document.querySelector('img')).toBeNull();
  });

  it('sin thumbnailUrl no hay <img> y la página no se rompe', async () => {
    open({ thumbnailUrl: undefined });
    await screen.findByText('Sep 24, 2026');
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getAllByLabelText(/^Score/)).toHaveLength(5);
  });

  it('«← Back» lleva a /upload', async () => {
    open();
    const back = await screen.findByRole('link', { name: /Back/ });
    expect(back).toHaveAttribute('href', '/upload');
    await userEvent.setup().click(back);
    await waitFor(() => expect(currentPath()).toBe('/upload'));
  });

  it('no hay botones de utilidad Yes/No (C-77)', async () => {
    open();
    await screen.findByText('Sep 24, 2026');
    expect(screen.queryByText('Was this critique useful?')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Yes' })).toBeNull();
  });

  it('el detalle se lee siempre de GET /api/uploads/:id y vive dentro del layout', async () => {
    const { f } = open();
    await screen.findByText('Sep 24, 2026');
    expect(f.calls().filter((c) => c.key === `GET /api/uploads/${UPLOAD_ID}`)).toHaveLength(1);
    expect(
      within(screen.getByRole('complementary')).getByRole('link', { name: 'Upload' })
    ).toBeInTheDocument();
  });
});
