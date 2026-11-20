import { createApiClient } from '../api/client';
import { deleteHistory } from '../api/settings';
import { fakeJwt, jsonResponse } from './helpers';

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

describe('deleteHistory', () => {
  it('llama a DELETE /api/history con { confirmation: "DELETE" }, validado contra DeleteHistoryRequestSchema', async () => {
    const { client, fetchFn } = setup(() => ({ ok: true, status: 204, text: async () => '' }));
    const out = await deleteHistory(client);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/history');
    expect(init.method).toBe('DELETE');
    expect(init.body).toBe('{"confirmation":"DELETE"}');
    expect(out.ok).toBe(true);
    expect(out.status).toBe(204);
  });

  it('un 400 se trata como error, sin inventar datos', async () => {
    const { client } = setup(() =>
      jsonResponse(400, { data: null, error: 'invalid confirmation', status: 400 })
    );
    const out = await deleteHistory(client);
    expect(out).toMatchObject({ ok: false, status: 400, data: null });
  });

  it('un 401 llama a onUnauthorized', async () => {
    const { client, onUnauthorized } = setup(() => jsonResponse(401, {}));
    await deleteHistory(client);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('un 5xx se trata como error', async () => {
    const { client } = setup(() => jsonResponse(500, {}));
    const out = await deleteHistory(client);
    expect(out).toMatchObject({ ok: false, status: 500, data: null });
  });
});
