import { screen, within } from '@testing-library/react';
import { jsonResponse, setupApp, uuidN } from './helpers';

function trendsOk(categories: unknown[], tier: 'free' | 'paid' = 'free') {
  return jsonResponse(200, { data: { tier, categories }, error: null, status: 200 });
}

const ALL_STATUSES = [
  {
    categoryId: 'CAT-1',
    categoryName: 'Composition',
    status: 'locked',
  },
  {
    categoryId: 'CAT-2',
    categoryName: 'Proportions',
    status: 'insufficient_data',
    uploadsNeeded: 3,
  },
  {
    categoryId: 'CAT-3',
    categoryName: 'Line Quality',
    status: 'improving',
    trend: {
      direction: 'improving',
      scoreHistory: [
        { uploadId: uuidN(1), score: 62, timestamp: '2026-09-01T00:00:00.000Z' },
        { uploadId: uuidN(2), score: 68, timestamp: '2026-09-10T00:00:00.000Z' },
        { uploadId: uuidN(3), score: 74, timestamp: '2026-09-20T00:00:00.000Z' },
      ],
    },
  },
  {
    categoryId: 'CAT-4',
    categoryName: 'Values (Shading)',
    status: 'stagnating',
    trend: {
      direction: 'stagnating',
      scoreHistory: [
        { uploadId: uuidN(4), score: 50, timestamp: '2026-09-01T00:00:00.000Z' },
        { uploadId: uuidN(5), score: 51, timestamp: '2026-09-10T00:00:00.000Z' },
      ],
    },
  },
  {
    categoryId: 'CAT-5',
    categoryName: 'Perspective',
    status: 'worsening',
    trend: {
      direction: 'worsening',
      scoreHistory: [
        { uploadId: uuidN(6), score: 80, timestamp: '2026-09-01T00:00:00.000Z' },
        { uploadId: uuidN(7), score: 70, timestamp: '2026-09-10T00:00:00.000Z' },
      ],
    },
  },
];

describe('Trends — pantalla /trends, por valor', () => {
  it('encabezado, 5 categorías en orden CAT-1..5 con categoryName en mayúsculas', async () => {
    setupApp('/trends', { 'GET /api/trends': () => trendsOk(ALL_STATUSES) });
    await screen.findByText('COMPOSITION');
    expect(screen.getByRole('heading', { name: 'Progress Trends' })).toBeInTheDocument();
    const names = ['PROPORTIONS', 'LINE QUALITY', 'VALUES (SHADING)', 'PERSPECTIVE'];
    for (const n of names) expect(screen.getByText(n)).toBeInTheDocument();
  });

  it('locked: etiqueta Locked, sin badge de dirección ni scores, enlace a /upgrade', async () => {
    setupApp('/trends', { 'GET /api/trends': () => trendsOk(ALL_STATUSES) });
    await screen.findByText('COMPOSITION');
    const card = screen.getByText('COMPOSITION').closest('article') as HTMLElement;
    expect(within(card).getByText('Locked')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Upgrade to see trends' })).toHaveAttribute(
      'href',
      '/upgrade'
    );
    expect(within(card).queryByText(/Improving|Stagnating|Worsening/)).toBeNull();
    expect(within(card).queryByText(/→/)).toBeNull();
  });

  it('insufficient_data: singular con uploadsNeeded=1, plural con 3', async () => {
    setupApp('/trends', {
      'GET /api/trends': () =>
        trendsOk([
          { ...ALL_STATUSES[1], uploadsNeeded: 1 },
          { ...ALL_STATUSES[0], categoryId: 'CAT-1' },
          { ...ALL_STATUSES[2] },
          { ...ALL_STATUSES[3] },
          { ...ALL_STATUSES[4] },
        ]),
    });
    expect(await screen.findByText('1 more upload needed')).toBeInTheDocument();

    setupApp('/trends', { 'GET /api/trends': () => trendsOk(ALL_STATUSES) });
    expect(await screen.findByText('3 more uploads needed')).toBeInTheDocument();
  });

  it('improving: badge Improving y scoreHistory en orden exacto', async () => {
    setupApp('/trends', { 'GET /api/trends': () => trendsOk(ALL_STATUSES) });
    expect(await screen.findByText('Improving')).toBeInTheDocument();
    expect(screen.getByText('62 → 68 → 74')).toBeInTheDocument();
  });

  it('stagnating y worsening: badges con sus textos literales', async () => {
    setupApp('/trends', { 'GET /api/trends': () => trendsOk(ALL_STATUSES) });
    expect(await screen.findByText('Stagnating')).toBeInTheDocument();
    expect(screen.getByText('Worsening')).toBeInTheDocument();
  });

  it('ninguna categoría infiere datos de sus vecinas', async () => {
    setupApp('/trends', { 'GET /api/trends': () => trendsOk(ALL_STATUSES) });
    await screen.findByText('COMPOSITION');
    // Solo un enlace "Upgrade to see trends" (el de la única categoría locked).
    expect(screen.getAllByRole('link', { name: 'Upgrade to see trends' })).toHaveLength(1);
    // Solo un "Not enough data yet" (la única insufficient_data).
    expect(screen.getAllByText('Not enough data yet')).toHaveLength(1);
  });
});
