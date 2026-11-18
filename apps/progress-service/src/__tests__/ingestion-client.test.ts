import { fetchUploadList } from '../service/ingestion-client';
import {
  FakeIngestion,
  ID_1,
  closedPortUrl,
  listBody,
  readyItem,
  startFakeIngestion,
} from './fake-ingestion';

describe('fetchUploadList', () => {
  let fake: FakeIngestion;
  beforeEach(async () => {
    fake = await startFakeIngestion();
  });
  afterEach(async () => {
    await fake.close();
  });

  const call = (baseUrl: string, timeoutMs = 2000, fetchFn: typeof fetch = fetch) =>
    fetchUploadList({ authorization: 'Bearer token-de-prueba', fetchFn, baseUrl, timeoutMs });

  it('ok con items validados', async () => {
    const items = [readyItem(ID_1, '2026-11-03T10:00:00.000Z')];
    fake.respond(200, listBody(items));
    await expect(call(fake.url)).resolves.toEqual({ ok: true, items });
  });

  it('401 -> unauthenticated; 500/403 -> upstream; basura -> bad-response', async () => {
    fake.respond(401, '{}');
    await expect(call(fake.url)).resolves.toEqual({ ok: false, kind: 'unauthenticated' });
    fake.respond(500, '{}');
    await expect(call(fake.url)).resolves.toEqual({ ok: false, kind: 'upstream' });
    fake.respond(403, '{}');
    await expect(call(fake.url)).resolves.toEqual({ ok: false, kind: 'upstream' });
    fake.respond(200, 'no json');
    await expect(call(fake.url)).resolves.toEqual({ ok: false, kind: 'bad-response' });
  });

  it('timeout pequeno -> timeout', async () => {
    fake.respond(200, listBody([]), 500);
    await expect(call(fake.url, 50)).resolves.toEqual({ ok: false, kind: 'timeout' });
  });

  it('conexion rechazada -> upstream', async () => {
    await expect(call(await closedPortUrl())).resolves.toEqual({ ok: false, kind: 'upstream' });
  });

  it('nunca lanza: fetch que lanza un error generico o un valor no-Error -> upstream', async () => {
    const boom: typeof fetch = () => Promise.reject(new Error('boom'));
    await expect(call(fake.url, 2000, boom)).resolves.toEqual({ ok: false, kind: 'upstream' });
    const weird: typeof fetch = () => Promise.reject('texto');
    await expect(call(fake.url, 2000, weird)).resolves.toEqual({ ok: false, kind: 'upstream' });
    const syncThrow: typeof fetch = () => {
      throw new Error('sync');
    };
    await expect(call(fake.url, 2000, syncThrow)).resolves.toEqual({ ok: false, kind: 'upstream' });
  });

  it('baseUrl con barra final no duplica la barra', async () => {
    fake.respond(200, listBody([]));
    await call(`${fake.url}/`);
    expect(fake.requests[0].url).toBe('/api/uploads');
  });
});
