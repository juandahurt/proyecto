import { createApiClient } from '../api/client';
import { getLimits, getUpload, listUploads, uploadImage } from '../api/uploads';
import {
  UPLOAD_ID,
  acceptedOk,
  detailOk,
  fakeJwt,
  headersOf,
  jsonResponse,
  limitsOk,
  listItem,
  listOk,
  makeFile,
} from './helpers';

function setup(respond: () => unknown | Promise<unknown>) {
  const fetchFn = jest.fn(async () => respond());
  const onUnauthorized = jest.fn();
  const token = fakeJwt();
  const client = createApiClient({
    fetchFn: fetchFn as unknown as typeof fetch,
    getToken: () => token,
    onUnauthorized,
  });
  return { client, fetchFn, onUnauthorized, token };
}

function firstCall(fetchFn: jest.Mock): [string, RequestInit] {
  expect(fetchFn).toHaveBeenCalledTimes(1);
  return fetchFn.mock.calls[0] as unknown as [string, RequestInit];
}

const htmlResponse = (status: number, html: string) => ({
  ok: false,
  status,
  text: async () => html,
});

describe('uploadImage', () => {
  it('hace POST /api/uploads con un FormData cuyo único campo es "file", sin Content-Type', async () => {
    const { client, fetchFn, token } = setup(() => acceptedOk());
    const out = await uploadImage(client, makeFile('image/png', 10, 'mi-dibujo-secreto.png'));
    expect(out.ok).toBe(true);
    const [url, init] = firstCall(fetchFn);
    expect(url).toBe('/api/uploads');
    expect(init.method).toBe('POST');
    const body = init.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect([...body.keys()]).toEqual(['file']);
    const headers = headersOf(init);
    expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain('content-type');
    expect(headers.Authorization).toBe(`Bearer ${token}`);
    expect(init.credentials).toBe('omit');
    expect(init.redirect).toBe('error');
  });

  it('nunca manda el nombre del archivo del usuario y conserva el tipo', async () => {
    const { client, fetchFn } = setup(() => acceptedOk());
    await uploadImage(client, makeFile('image/webp', 10, 'mi-dibujo-secreto.webp'));
    const [, init] = firstCall(fetchFn);
    const sent = (init.body as FormData).get('file') as File;
    expect(sent.name).not.toContain('secreto');
    expect(sent.type).toBe('image/webp');
    expect(sent.size).toBe(10);
  });

  it('valida la respuesta 202 con UploadResultSchema y devuelve el uploadId', async () => {
    const { client } = setup(() => acceptedOk({ status: 'ready' }));
    const out = await uploadImage(client, makeFile('image/jpeg'));
    expect(out).toMatchObject({ ok: true, status: 202, kind: 'none' });
    expect(out.data?.uploadId).toBe(UPLOAD_ID);
  });

  it('una respuesta 202 que no cumple el schema es un error del servidor', async () => {
    const { client } = setup(() =>
      jsonResponse(202, { data: { uploadId: 'no-uuid' }, error: null })
    );
    const out = await uploadImage(client, makeFile('image/jpeg'));
    expect(out).toMatchObject({ ok: false, kind: 'server', data: null });
  });

  it('un 401 llama a onUnauthorized', async () => {
    const { client, onUnauthorized } = setup(() => jsonResponse(401, {}));
    const out = await uploadImage(client, makeFile('image/jpeg'));
    expect(out).toMatchObject({ ok: false, status: 401, kind: 'unauthorized' });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('un 413 sin cuerpo JSON (nginx, HTML o vacío) se mapea igual que un 413 con envoltorio', async () => {
    const wrapped = await uploadImage(
      setup(() => jsonResponse(413, { data: null, error: 'File too large.', status: 413 })).client,
      makeFile('image/jpeg')
    );
    const html = await uploadImage(
      setup(() => htmlResponse(413, '<html><body>413 Request Entity Too Large</body></html>'))
        .client,
      makeFile('image/jpeg')
    );
    const empty = await uploadImage(
      setup(() => htmlResponse(413, '')).client,
      makeFile('image/jpeg')
    );
    for (const out of [wrapped, html, empty]) {
      expect(out).toMatchObject({ ok: false, status: 413, kind: 'client', data: null });
    }
  });

  it('un error de red es kind "network"', async () => {
    const { client } = setup(() => {
      throw new TypeError('x');
    });
    expect(await uploadImage(client, makeFile('image/jpeg'))).toMatchObject({
      ok: false,
      kind: 'network',
    });
  });
});

describe('getUpload', () => {
  it('GET /api/uploads/:id y valida con UploadDetailSchema', async () => {
    const { client, fetchFn } = setup(() => detailOk());
    const out = await getUpload(client, UPLOAD_ID);
    expect(firstCall(fetchFn)[0]).toBe(`/api/uploads/${UPLOAD_ID}`);
    expect(out.ok).toBe(true);
    expect(out.data?.timestamp).toBe('2026-09-24T15:30:00.000Z');
    expect(out.data?.categories).toHaveLength(5);
  });

  it('un 200 que no cumple el schema es un error del servidor', async () => {
    const { client } = setup(() => detailOk({ timestamp: 'ayer' }));
    expect(await getUpload(client, UPLOAD_ID)).toMatchObject({ ok: false, kind: 'server' });
  });

  it.each([404, 403])('un %i se conserva como error de cliente', async (status) => {
    const { client } = setup(() => jsonResponse(status, { data: null, error: 'x', status }));
    expect(await getUpload(client, UPLOAD_ID)).toMatchObject({ ok: false, status, kind: 'client' });
  });

  it('un 401 llama a onUnauthorized', async () => {
    const { client, onUnauthorized } = setup(() => jsonResponse(401, {}));
    await getUpload(client, UPLOAD_ID);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});

describe('listUploads', () => {
  it('GET /api/uploads y devuelve los items validados con UploadListSchema', async () => {
    const { client, fetchFn } = setup(() => listOk([listItem(1), listItem(2)]));
    const out = await listUploads(client);
    expect(firstCall(fetchFn)[0]).toBe('/api/uploads');
    expect(out.ok).toBe(true);
    expect(out.data?.map((i) => i.uploadId)).toEqual([listItem(1).uploadId, listItem(2).uploadId]);
  });

  it('un cuerpo que no cumple el schema es un error del servidor', async () => {
    const { client } = setup(() => listOk([{ uploadId: 'x' }]));
    expect(await listUploads(client)).toMatchObject({ ok: false, kind: 'server', data: null });
  });

  it('un 401 llama a onUnauthorized', async () => {
    const { client, onUnauthorized } = setup(() => jsonResponse(401, {}));
    await listUploads(client);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});

describe('getLimits', () => {
  it('GET /api/users/me/limits y valida con LimitsResponseSchema', async () => {
    const { client, fetchFn } = setup(() => limitsOk());
    const out = await getLimits(client);
    expect(firstCall(fetchFn)[0]).toBe('/api/users/me/limits');
    expect(out.data).toEqual({
      tier: 'free',
      uploadsRemaining: 7,
      uploadsLimit: 10,
      resetDate: '2026-10-01',
    });
  });

  it('paid con nulls es válido', async () => {
    const { client } = setup(() =>
      limitsOk({ tier: 'paid', uploadsRemaining: null, uploadsLimit: null, resetDate: null })
    );
    const out = await getLimits(client);
    expect(out.ok).toBe(true);
    expect(out.data?.tier).toBe('paid');
  });

  it('un cuerpo que no cumple el schema es un error del servidor', async () => {
    const { client } = setup(() => limitsOk({ tier: 'gold' }));
    expect(await getLimits(client)).toMatchObject({ ok: false, kind: 'server' });
  });

  it('un 401 llama a onUnauthorized', async () => {
    const { client, onUnauthorized } = setup(() => jsonResponse(401, {}));
    await getLimits(client);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
