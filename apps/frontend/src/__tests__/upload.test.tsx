import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  TOKEN_KEY,
  UPLOAD_ID,
  acceptedOk,
  countOf,
  currentPath,
  dropOn,
  expectFileNameAbsent,
  fileInput,
  jsonResponse,
  makeFile,
  setupApp,
  zone,
} from './helpers';

const SECRET_STEM = 'mi-dibujo-secreto-7f3a';
const SECRET_NAME = `${SECRET_STEM}.jpg`;

describe('Upload (2A): durante la petición', () => {
  it('la zona se sustituye por un indicador role=status, no hay segundo envío y la barra sigue operable', async () => {
    let release: (r: ReturnType<typeof acceptedOk>) => void = () => undefined;
    const pending = new Promise<ReturnType<typeof acceptedOk>>((r) => (release = r));
    const { f } = setupApp('/upload', { 'POST /api/uploads': () => pending as never });
    await screen.findByRole('group', { name: 'Drop zone for your drawing' });
    dropOn(zone(), [makeFile('image/jpeg')]);
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(/Analyzing/);
    expect(screen.queryByRole('group', { name: 'Drop zone for your drawing' })).toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    // soltar otro archivo en el documento no produce un segundo envío
    act(() => {
      dropOn(document.body, [makeFile('image/png')]);
    });
    expect(countOf(f, 'POST /api/uploads')).toBe(1);
    // los enlaces de la barra lateral siguen operables
    expect(screen.getByRole('link', { name: 'My History' })).toBeEnabled();
    await act(async () => release(acceptedOk()));
    await waitFor(() => expect(currentPath()).toBe(`/uploads/${UPLOAD_ID}`));
  });
});

describe('Upload (2A): errores del servidor', () => {
  const cases: Array<[string, () => unknown, string]> = [
    [
      '413',
      () => jsonResponse(413, { data: null, error: 'x', status: 413 }),
      'File too large — maximum 10 MB',
    ],
    [
      '413 sin JSON',
      () => ({ ok: false, status: 413, text: async () => '<html>413</html>' }),
      'File too large — maximum 10 MB',
    ],
    [
      '422',
      () => jsonResponse(422, { data: null, error: 'Invalid image format', status: 422 }),
      "That file doesn't look like a valid image",
    ],
    [
      '5xx',
      () => jsonResponse(500, { data: null, error: 'x', status: 500 }),
      'Upload failed — please try again',
    ],
    [
      '202 inválido',
      () => jsonResponse(202, { data: { uploadId: 'no' } }),
      'Upload failed — please try again',
    ],
    [
      'red',
      () => {
        throw new TypeError('network');
      },
      'Upload failed — check your connection and try again',
    ],
  ];

  it.each(cases)(
    '%s: mensaje exacto, sin navegar, sin guardar nada y la zona vuelve',
    async (_n, respond, text) => {
      const { f } = setupApp('/upload', { 'POST /api/uploads': respond as never });
      await screen.findByRole('group', { name: 'Drop zone for your drawing' });
      dropOn(zone(), [makeFile('image/jpeg', 100, SECRET_NAME)]);
      expect(await screen.findByRole('alert')).toHaveTextContent(text);
      expect(currentPath()).toBe('/upload');
      expect(Object.keys(window.localStorage)).toEqual([TOKEN_KEY]);
      expect(screen.getByRole('group', { name: 'Drop zone for your drawing' })).toBeInTheDocument();
      expect(countOf(f, 'POST /api/uploads')).toBe(1);
      // reintento posible
      dropOn(zone(), [makeFile('image/jpeg')]);
      await waitFor(() => expect(countOf(f, 'POST /api/uploads')).toBe(2));
    }
  );

  it('un 401 al subir cierra la sesión', async () => {
    setupApp('/upload', { 'POST /api/uploads': () => jsonResponse(401, {}) });
    await screen.findByRole('group', { name: 'Drop zone for your drawing' });
    dropOn(zone(), [makeFile('image/jpeg')]);
    await waitFor(() => expect(currentPath()).toBe('/login'));
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('un mensaje de error anterior desaparece al empezar otro envío', async () => {
    setupApp('/upload', { 'POST /api/uploads': () => acceptedOk() });
    await screen.findByRole('group', { name: 'Drop zone for your drawing' });
    dropOn(zone(), [makeFile('image/gif')]);
    await screen.findByRole('alert');
    dropOn(zone(), [makeFile('image/jpeg')]);
    await waitFor(() => expect(currentPath()).toBe(`/uploads/${UPLOAD_ID}`));
    expect(screen.queryByText('Only JPEG, PNG, and WebP files are accepted')).toBeNull();
  });
});

describe('Upload: el nombre del archivo del usuario no sale del File (todos los estados terminales)', () => {
  const rejected: Array<[string, File[], string]> = [
    ['tipo no permitido', [makeFile('image/gif', 100, `${SECRET_STEM}.gif`)], 'Only JPEG'],
    [
      'tamaño excedido',
      [makeFile('image/jpeg', 10 * 1024 * 1024 + 1, SECRET_NAME)],
      'File too large',
    ],
    [
      'dos archivos',
      [
        makeFile('image/jpeg', 100, SECRET_NAME),
        makeFile('image/png', 100, `${SECRET_STEM}-2.png`),
      ],
      'one image at a time',
    ],
  ];

  it('éxito: ni en la ubicación completa, ni en el DOM, ni en el almacenamiento, ni en el FormData', async () => {
    const { f } = setupApp('/upload', { 'POST /api/uploads': () => acceptedOk() });
    await screen.findByRole('group', { name: 'Drop zone for your drawing' });
    dropOn(zone(), [makeFile('image/jpeg', 100, SECRET_NAME)]);
    await waitFor(() => expect(currentPath()).toBe(`/uploads/${UPLOAD_ID}`));
    await screen.findByText('Sep 24, 2026');
    expectFileNameAbsent(SECRET_STEM);
    const call = f.calls().find((c) => c.key === 'POST /api/uploads')!;
    expect(((call.init.body as FormData).get('file') as File).name).not.toContain(SECRET_STEM);
  });

  it.each(rejected)('rechazo del cliente (%s)', async (_n, files, text) => {
    const { f } = setupApp('/upload');
    await screen.findByRole('group', { name: 'Drop zone for your drawing' });
    dropOn(zone(), files);
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expectFileNameAbsent(SECRET_STEM);
    expect(countOf(f, 'POST /api/uploads')).toBe(0);
  });

  it('el helper detecta el nombre en el DOM y en el almacenamiento (el helper no es decorativo)', () => {
    document.body.innerHTML = `<p>${SECRET_STEM}</p>`;
    expect(() => expectFileNameAbsent(SECRET_STEM)).toThrow();
    document.body.innerHTML = '';
    window.sessionStorage.setItem('x', SECRET_STEM);
    expect(() => expectFileNameAbsent(SECRET_STEM)).toThrow();
    window.sessionStorage.clear();
  });
});

describe('Upload: segundo envío con la petición en vuelo', () => {
  it('dos selecciones síncronas dentro de un solo act() sobre el input real producen un solo POST', async () => {
    const pending = new Promise<ReturnType<typeof acceptedOk>>(() => undefined);
    const { f } = setupApp('/upload', { 'POST /api/uploads': () => pending as never });
    await screen.findByRole('group', { name: 'Drop zone for your drawing' });
    const input = fileInput();
    await act(async () => {
      fireEvent.change(input, { target: { files: [makeFile('image/jpeg', 100, 'a.jpg')] } });
      fireEvent.change(input, { target: { files: [makeFile('image/png', 100, 'b.png')] } });
    });
    expect(countOf(f, 'POST /api/uploads')).toBe(1);
  });
});

describe('Upload: teclado', () => {
  it('«Browse file» recibe foco con Tab y la página no roba el foco al cargar', async () => {
    setupApp('/upload');
    await screen.findByRole('group', { name: 'Drop zone for your drawing' });
    expect(document.body).toHaveFocus();
    const user = userEvent.setup();
    for (let i = 0; i < 12 && document.activeElement?.textContent !== 'Browse file'; i++) {
      await user.tab();
    }
    expect(screen.getByRole('button', { name: 'Browse file' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  });
});
