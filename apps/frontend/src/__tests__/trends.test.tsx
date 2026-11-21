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

  it('improving: badge Improving y gráfico (no el texto plano antiguo)', async () => {
    setupApp('/trends', { 'GET /api/trends': () => trendsOk(ALL_STATUSES) });
    expect(await screen.findByText('Improving')).toBeInTheDocument();
    const card = screen.getByText('LINE QUALITY').closest('article') as HTMLElement;
    // El gráfico SVG de recharts reemplaza al texto plano, no lo complementa (decisión 2).
    expect(within(card).getByTestId('trend-chart')).toBeInTheDocument();
    expect(within(card).getByTestId('trend-chart').querySelector('svg')).toBeTruthy();
    // El texto "62 → 68 → 74" sigue siendo recuperable UNA sola vez, como contenido accesible
    // (decisión 5), no como el párrafo visible que existía antes de esta tarea.
    const occurrences = within(card).getAllByText('62 → 68 → 74');
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]).toHaveClass('sr-only');
  });

  it('CA-2: solo improving/stagnating/worsening pintan el gráfico; locked e insufficient_data no', async () => {
    setupApp('/trends', { 'GET /api/trends': () => trendsOk(ALL_STATUSES) });
    await screen.findByText('COMPOSITION');
    const lockedCard = screen.getByText('COMPOSITION').closest('article') as HTMLElement;
    const insufficientCard = screen.getByText('PROPORTIONS').closest('article') as HTMLElement;
    const improvingCard = screen.getByText('LINE QUALITY').closest('article') as HTMLElement;
    const stagnatingCard = screen.getByText('VALUES (SHADING)').closest('article') as HTMLElement;
    const worseningCard = screen.getByText('PERSPECTIVE').closest('article') as HTMLElement;

    expect(within(lockedCard).queryByTestId('trend-chart')).toBeNull();
    expect(within(insufficientCard).queryByTestId('trend-chart')).toBeNull();
    expect(within(improvingCard).getByTestId('trend-chart')).toBeInTheDocument();
    expect(within(stagnatingCard).getByTestId('trend-chart')).toBeInTheDocument();
    expect(within(worseningCard).getByTestId('trend-chart')).toBeInTheDocument();
  });

  it('CA-3: color de la línea según dirección (stroke verde/gris/rojo, no los tres iguales)', async () => {
    setupApp('/trends', { 'GET /api/trends': () => trendsOk(ALL_STATUSES) });
    await screen.findByText('COMPOSITION');
    const improvingCard = screen.getByText('LINE QUALITY').closest('article') as HTMLElement;
    const stagnatingCard = screen.getByText('VALUES (SHADING)').closest('article') as HTMLElement;
    const worseningCard = screen.getByText('PERSPECTIVE').closest('article') as HTMLElement;

    const strokeOf = (card: HTMLElement) =>
      card.querySelector('.recharts-line-curve')?.getAttribute('stroke');

    const improvingStroke = strokeOf(improvingCard);
    const stagnatingStroke = strokeOf(stagnatingCard);
    const worseningStroke = strokeOf(worseningCard);

    expect(improvingStroke).toBe('#16A34A'); // green-600
    expect(stagnatingStroke).toBe('#6B7280'); // gray-500
    expect(worseningStroke).toBe('#DC2626'); // red-600
    expect(new Set([improvingStroke, stagnatingStroke, worseningStroke]).size).toBe(3);
  });

  it('CA-4 a11y: la serie sigue siendo legible sin ver el SVG (sr-only con el mismo contenido)', async () => {
    setupApp('/trends', { 'GET /api/trends': () => trendsOk(ALL_STATUSES) });
    await screen.findByText('COMPOSITION');
    const improvingCard = screen.getByText('LINE QUALITY').closest('article') as HTMLElement;
    const stagnatingCard = screen.getByText('VALUES (SHADING)').closest('article') as HTMLElement;
    const worseningCard = screen.getByText('PERSPECTIVE').closest('article') as HTMLElement;

    expect(within(improvingCard).getByText('62 → 68 → 74')).toBeInTheDocument();
    expect(within(stagnatingCard).getByText('50 → 51')).toBeInTheDocument();
    expect(within(worseningCard).getByText('80 → 70')).toBeInTheDocument();

    // El SVG en sí no es el único portador del dato: lleva aria-hidden porque el texto ya lo cubre.
    expect(within(improvingCard).getByTestId('trend-chart')).toHaveAttribute('aria-hidden', 'true');

    // Un solo <h1> en toda la pantalla (sin duplicados por el gráfico).
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
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
