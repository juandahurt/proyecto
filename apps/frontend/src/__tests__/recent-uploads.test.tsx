import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  UPLOAD_ID,
  acceptedOk,
  countOf,
  currentPath,
  dropOn,
  jsonResponse,
  listItem,
  listOk,
  makeFile,
  setupApp,
  uuidN,
} from './helpers';

const rows = () =>
  within(screen.getByRole('list', { name: 'Recent uploads' })).getAllByRole('listitem');

describe('Recent uploads', () => {
  it('muestra hasta 5 filas en el orden del servidor, con fecha UTC, etiqueta y enlace View', async () => {
    const items = [
      listItem(9),
      listItem(8, { status: 'low_confidence', confidence: 'LOW', fallbackReason: 'timeout' }),
      listItem(7),
      listItem(6),
      listItem(5),
      listItem(4),
      listItem(3),
    ];
    setupApp('/upload', { 'GET /api/uploads': () => listOk(items) });
    await screen.findByRole('heading', { name: 'Recent uploads' });
    await waitFor(() => expect(rows()).toHaveLength(5));
    const r = rows();
    expect(r[0]).toHaveTextContent('Sep 19, 2026');
    expect(r[1]).toHaveTextContent('Sep 18, 2026');
    expect(r[4]).toHaveTextContent('Sep 15, 2026');
    expect(within(r[0]).getByText('Ready')).toBeInTheDocument();
    expect(within(r[1]).getByText('Low confidence')).toBeInTheDocument();
    expect(within(r[1]).queryByText('Ready')).toBeNull();
    r.forEach((row, i) => {
      expect(within(row).getByRole('link', { name: 'View' })).toHaveAttribute(
        'href',
        `/uploads/${uuidN(9 - i)}`
      );
    });
  });

  it('lista vacía: «No uploads yet»', async () => {
    setupApp('/upload', { 'GET /api/uploads': () => listOk([]) });
    expect(await screen.findByText('No uploads yet')).toBeInTheDocument();
  });

  it('no hay miniaturas ni nombres (C-78)', async () => {
    setupApp('/upload', { 'GET /api/uploads': () => listOk([listItem(1)]) });
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(document.querySelector('img')).toBeNull();
  });

  it.each([
    ['5xx', () => jsonResponse(500, {})],
    [
      'red',
      () => {
        throw new TypeError('network');
      },
    ],
    ['forma inválida', () => listOk([{ uploadId: 'x' }])],
  ])('error de la lectura (%s): no aparece la lista y la zona sigue activa', async (_n, fail) => {
    const { f } = setupApp('/upload', { 'GET /api/uploads': fail as never });
    await screen.findByRole('group', { name: 'Drop zone for your drawing' });
    await waitFor(() => expect(countOf(f, 'GET /api/uploads')).toBe(1));
    expect(screen.queryByRole('list', { name: 'Recent uploads' })).toBeNull();
    expect(screen.queryByText('No uploads yet')).toBeNull();
    expect(document.querySelector('input[type="file"]')).not.toBeNull();
  });

  it('«View» abre /uploads/<id>', async () => {
    setupApp('/upload', {
      'GET /api/uploads': () => listOk([listItem(1)]),
      [`GET /api/uploads/${uuidN(1)}`]: () => jsonResponse(404, {}),
    });
    await userEvent.setup().click(await screen.findByRole('link', { name: 'View' }));
    await waitFor(() => expect(currentPath()).toBe(`/uploads/${uuidN(1)}`));
  });

  it('la lista se recarga tras una subida aceptada', async () => {
    const { f } = setupApp('/upload', {
      'GET /api/uploads': () => listOk([listItem(1)]),
      'POST /api/uploads': () => acceptedOk(),
    });
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(countOf(f, 'GET /api/uploads')).toBe(1);
    dropOn(await screen.findByRole('group', { name: 'Drop zone for your drawing' }), [
      makeFile('image/jpeg'),
    ]);
    await waitFor(() => expect(currentPath()).toBe(`/uploads/${UPLOAD_ID}`));
    await waitFor(() => expect(countOf(f, 'GET /api/uploads')).toBe(2));
  });
});
