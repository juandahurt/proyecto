import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { countOf, currentPath, fullLocation, listItem, listOk, setupApp, uuidN } from './helpers';

const READY_SCORES = [
  { categoryId: 'CAT-1', score: 72 },
  { categoryId: 'CAT-2', score: 40 },
  { categoryId: 'CAT-3', score: 81 },
  { categoryId: 'CAT-4', score: 40 },
  { categoryId: 'CAT-5', score: 77 },
];

const READY_ITEM = listItem(1, {
  scores: READY_SCORES,
  thumbnailUrl: `/api/uploads/${uuidN(1)}/thumbnail?exp=1&sig=a`,
});
const LOW_CONFIDENCE_ITEM = listItem(2, {
  status: 'low_confidence',
  confidence: 'LOW',
  scores: [],
  fallbackReason: 'timeout',
  thumbnailUrl: `/api/uploads/${uuidN(2)}/thumbnail?exp=1&sig=b`,
});

describe('History — tabla (US-5)', () => {
  it('encabezado, columnas y ambos tipos de fila (ready y low_confidence)', async () => {
    setupApp('/history', { 'GET /api/uploads': () => listOk([READY_ITEM, LOW_CONFIDENCE_ITEM]) });
    expect(await screen.findByRole('heading', { name: 'My History' })).toBeInTheDocument();
    const headers = (await screen.findAllByRole('columnheader')).map((h) => h.textContent);
    expect(headers).toEqual(['Image', 'Date', 'Focus area', 'Score']);

    // Focus area = score más bajo; CAT-2 y CAT-4 empatan en 40 -> gana CAT-2 (categoryId más bajo)
    expect(screen.getByText('PROPORTIONS')).toBeInTheDocument();
    expect(screen.getByLabelText('Score 40 out of 100')).toHaveTextContent('40 / 100');

    // low_confidence: Focus area '—' sin tooltip, Score 'Low confidence'
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Low confidence')).toBeInTheDocument();
  });

  it('tooltip de Focus area con el texto exacto, solo en items ready', async () => {
    setupApp('/history', { 'GET /api/uploads': () => listOk([READY_ITEM, LOW_CONFIDENCE_ITEM]) });
    await screen.findByText('PROPORTIONS');
    expect(screen.getByText('PROPORTIONS')).toHaveAttribute(
      'title',
      'The category with the most room to improve in this upload.'
    );
    expect(screen.getByText('—')).not.toHaveAttribute('title');
  });

  it('miniatura: solo se pinta <img> si thumbnailUrl empieza por /api/uploads/', async () => {
    const withBad = listItem(3, { thumbnailUrl: 'https://evil.test/x.png' });
    const withoutThumbnail = listItem(4, { thumbnailUrl: undefined });
    setupApp('/history', {
      'GET /api/uploads': () => listOk([READY_ITEM, withBad, withoutThumbnail]),
    });
    await screen.findByRole('heading', { name: 'My History' });
    await screen.findAllByRole('row');
    const imgs = Array.from(document.querySelectorAll('img'));
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toHaveAttribute('src', READY_ITEM.thumbnailUrl);
  });

  it('clic en una fila navega a /uploads/<id> con state.from = history', async () => {
    const user = userEvent.setup();
    setupApp('/history', { 'GET /api/uploads': () => listOk([READY_ITEM]) });
    const row = await screen.findByText('PROPORTIONS');
    await user.click(row.closest('tr')!);
    expect(currentPath()).toBe(`/uploads/${uuidN(1)}`);
    expect(fullLocation()).not.toContain('from=history');
    expect(document.querySelector('[data-testid="location-state"]')?.textContent).toBe(
      JSON.stringify({ from: 'history' })
    );
  });

  it('Enter sobre la fila enfocada navega igual que el clic', async () => {
    const user = userEvent.setup();
    setupApp('/history', { 'GET /api/uploads': () => listOk([READY_ITEM]) });
    const row = await screen.findByText('PROPORTIONS');
    (row.closest('tr') as HTMLElement).focus();
    await user.keyboard('{Enter}');
    expect(currentPath()).toBe(`/uploads/${uuidN(1)}`);
  });

  it('lista vacía: No uploads yet y enlace a /upload, sin tabla', async () => {
    setupApp('/history', { 'GET /api/uploads': () => listOk([]) });
    expect(await screen.findByText('No uploads yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Upload your first drawing' })).toHaveAttribute(
      'href',
      '/upload'
    );
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('error 500 en la lectura: mensaje en role=alert, sin tabla rota', async () => {
    setupApp('/history', {
      'GET /api/uploads': () => ({ ok: false, status: 500, text: async () => '' }),
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not load your history. Please try again.'
    );
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('error 401 en la lectura cierra la sesión (vuelve a /login)', async () => {
    setupApp('/history', {
      'GET /api/uploads': () => ({ ok: false, status: 401, text: async () => '' }),
    });
    await screen.findByRole('heading', { name: 'Log in' });
    expect(currentPath()).toBe('/login');
  });
});
