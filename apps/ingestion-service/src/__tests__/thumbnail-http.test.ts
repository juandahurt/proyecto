import os from 'os';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { ClaudeVisionResponse, UploadDetailSchema } from '@proyecto/shared-types';
import { createDatabase } from '../service/database';
import { createUploadRepository, UploadRepository } from '../service/upload-repository';
import { signThumbnailUrl } from '../service/thumbnail-url';
import { createApp } from '../server';

const TEST_JWT_VALUE = 'a-test-secret-for-tests-only';
const KEY = 'test-only-signing-key-0123456789abcdef';
const T0 = 1_700_000_000_000;
const USER_A = 'user-a-thumb';
const USER_B = 'user-b-thumb';
const FORBIDDEN = { data: null, error: 'Forbidden', status: 403 };
const NOT_FOUND = { data: null, error: 'Not Found', status: 404 };

const makeJwt = (u: string) =>
  jwt.sign({ sub: u }, TEST_JWT_VALUE, { algorithm: 'HS256', expiresIn: '7d' });

/** JPEG mínimo con bytes variados para que la comparación de buffer sea significativa. */
function jpeg(): Buffer {
  const b = Buffer.alloc(64);
  for (let i = 0; i < b.length; i++) b[i] = (i * 37 + 11) & 0xff;
  b[0] = 0xff;
  b[1] = 0xd8;
  b[2] = 0xff;
  b[3] = 0xe0;
  return b;
}
const sha = (b: Buffer) => crypto.createHash('sha256').update(b).digest('hex');

const STUB: ClaudeVisionResponse = {
  confidence: 'HIGH',
  categories: [
    { id: 'CAT-1', name: 'Composition', score: 70, feedback: 'ok' },
    { id: 'CAT-2', name: 'Proportions', score: 70, feedback: 'ok' },
    { id: 'CAT-3', name: 'Line Quality', score: 70, feedback: 'ok' },
    { id: 'CAT-4', name: 'Values (Shading)', score: 70, feedback: 'ok' },
    { id: 'CAT-5', name: 'Perspective', score: 70, feedback: 'ok' },
  ],
};

describe('GET /api/uploads/:uploadId/thumbnail y thumbnailUrl firmada', () => {
  let db: ReturnType<typeof createDatabase>;
  let repo: UploadRepository;
  let findByIdSpy: jest.SpyInstance;
  let app: ReturnType<typeof createApp>;
  let blobDir: string;
  let outsideDir: string;
  let clock: number;
  const claude = jest.fn();
  const origJwt = process.env.JWT_SECRET;
  const origBlob = process.env.BLOB_DIR;

  beforeAll(() => {
    process.env.JWT_SECRET = TEST_JWT_VALUE;
    blobDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingestion-thumb-test-'));
    outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingestion-thumb-outside-'));
    process.env.BLOB_DIR = blobDir;
    db = createDatabase(':memory:');
    repo = createUploadRepository(db);
    findByIdSpy = jest.spyOn(repo, 'findById');
    app = createApp({ db, repo, claudeClient: claude, signingKey: KEY, now: () => clock });
  });

  afterAll(() => {
    db.close();
    if (origJwt === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = origJwt;
    if (origBlob === undefined) delete process.env.BLOB_DIR;
    else process.env.BLOB_DIR = origBlob;
    fs.rmSync(blobDir, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    clock = T0;
    claude.mockReset();
    claude.mockResolvedValue(STUB);
    findByIdSpy.mockClear();
  });

  const post = (user: string, buf = jpeg()) =>
    request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${makeJwt(user)}`)
      .attach('file', buf, { filename: 'x.jpg', contentType: 'image/jpeg' });

  const detail = (id: string, user: string) =>
    request(app)
      .get(`/api/uploads/${id}`)
      .set('Authorization', `Bearer ${makeJwt(user)}`);

  async function issue(user = USER_A, buf = jpeg()) {
    const created = await post(user, buf);
    const id = created.body.data.uploadId as string;
    const d = await detail(id, user);
    expect(d.body.data.thumbnailUrl).toMatch(
      /^\/api\/uploads\/[^/]+\/thumbnail\?exp=\d+&sig=[0-9a-f]{64}$/
    );
    return { id, thumb: d.body.data.thumbnailUrl as string, detail: d };
  }

  it('el detalle del dueño trae thumbnailUrl con forma y exp = reloj + 900; pasa UploadDetailSchema', async () => {
    const { id, thumb, detail: d } = await issue();
    expect(d.status).toBe(200);
    expect(UploadDetailSchema.safeParse(d.body).success).toBe(true);
    const m = /^\/api\/uploads\/([^/]+)\/thumbnail\?exp=(\d+)&sig=([0-9a-f]{64})$/.exec(thumb);
    expect(m).not.toBeNull();
    expect(m![1]).toBe(id);
    expect(Number(m![2])).toBe(T0 / 1000 + 900);
  });

  it('low_confidence del dueño también trae thumbnailUrl firmada', async () => {
    claude.mockResolvedValueOnce({ ...STUB, confidence: 'LOW' });
    const created = await post(USER_A);
    expect(created.body.data.status).toBe('low_confidence');
    const d = await detail(created.body.data.uploadId, USER_A);
    expect(d.body.data.status).toBe('low_confidence');
    expect(typeof d.body.data.thumbnailUrl).toBe('string');
    expect(UploadDetailSchema.safeParse(d.body).success).toBe(true);
    const res = await request(app).get(d.body.data.thumbnailUrl);
    expect(res.status).toBe(200);
  });

  it('403 (otro usuario), 404 (inexistente, no UUID, sin crítica) y 401 no contienen thumbnailUrl, sig= ni exp=', async () => {
    const { id } = await issue();
    const bare = repo.create({
      userId: USER_A,
      storedFilename: 'x.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1,
    });
    const responses = [
      await detail(id, USER_B),
      await detail(crypto.randomUUID(), USER_A),
      await detail('abc', USER_A),
      await detail(bare.uploadId, USER_A),
      await request(app).get(`/api/uploads/${id}`),
    ];
    expect(responses.map((r) => r.status)).toEqual([403, 404, 404, 404, 401]);
    for (const r of responses) {
      const raw = JSON.stringify(r.body);
      expect(raw).not.toContain('thumbnailUrl');
      expect(raw).not.toContain('sig=');
      expect(raw).not.toContain('exp=');
    }
  });

  it('la URL se sirve sin JWT (sin Authorization): 200 con bytes idénticos y cabeceras seguras', async () => {
    const original = jpeg();
    const { thumb } = await issue(USER_A, original);
    const res = await request(app)
      .get(thumb)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(sha(res.body as Buffer)).toBe(sha(original));
    expect((res.body as Buffer).equals(original)).toBe(true);
    expect(res.headers['content-type']).toBe('image/jpeg');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cache-control']).toBe('private, no-store');
  });

  describe('firma inválida → 403 idéntico y sin consultar la BD (0 llamadas a findById)', () => {
    const cases: [string, (thumb: string, id: string, other: string) => string][] = [
      ['sig alterada', (t) => t.slice(0, -1) + (t.endsWith('0') ? '1' : '0')],
      ['exp alterado conservando sig', (t) => t.replace('exp=', 'exp=1')],
      ['sig de otro uploadId', (t, id, other) => t.replace(id, other)],
      ['sin exp', (t) => t.replace(/exp=\d+&/, '')],
      ['sin sig', (t) => t.replace(/&sig=[0-9a-f]+/, '')],
      ['sin query', (t) => t.split('?')[0]],
    ];
    it.each(cases)('%s', async (_n, mutate) => {
      const a = await issue();
      const b = await issue();
      findByIdSpy.mockClear();
      const res = await request(app).get(mutate(a.thumb, a.id, b.id));
      expect(res.status).toBe(403);
      expect(res.text).toBe(JSON.stringify(FORBIDDEN));
      expect(findByIdSpy).toHaveBeenCalledTimes(0);
    });

    it('expirada (reloj avanzado ≥ 900 s)', async () => {
      const { thumb } = await issue();
      findByIdSpy.mockClear();
      clock = T0 + 900_000;
      const res = await request(app).get(thumb);
      expect(res.status).toBe(403);
      expect(res.text).toBe(JSON.stringify(FORBIDDEN));
      clock = T0 + 899_000;
      expect((await request(app).get(thumb)).status).toBe(200);
      clock = T0 + 900_000;
      findByIdSpy.mockClear();
      await request(app).get(thumb);
      expect(findByIdSpy).toHaveBeenCalledTimes(0);
    });

    it.each([['abc'], ['..%2Fetc%2Fpasswd']])('uploadId no UUID %p', async (bad) => {
      const res = await request(app).get(
        `/api/uploads/${bad}/thumbnail?exp=${T0 / 1000 + 900}&sig=${'a'.repeat(64)}`
      );
      expect(res.status).toBe(403);
      expect(res.text).toBe(JSON.stringify(FORBIDDEN));
      expect(findByIdSpy).toHaveBeenCalledTimes(0);
    });
  });

  it('firma válida pero upload inexistente → 404', async () => {
    const url = signThumbnailUrl({ uploadId: crypto.randomUUID(), key: KEY, nowMs: T0 });
    const res = await request(app).get(url);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(NOT_FOUND);
    expect(findByIdSpy).toHaveBeenCalledTimes(1);
  });

  it('fila existente con blob borrado de BLOB_DIR → 404', async () => {
    const { id, thumb } = await issue();
    const row = repo.findById(id)!;
    fs.rmSync(path.join(blobDir, row.storedFilename));
    const res = await request(app).get(thumb);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(NOT_FOUND);
  });

  it.each([['../secret'], ['ABS']])(
    'stored_filename malicioso %p → 500 Failed to read file y no se lee fuera de BLOB_DIR (señuelo)',
    async (kind) => {
      const decoyName = 'secret';
      const decoyPath = path.join(outsideDir, decoyName);
      fs.writeFileSync(decoyPath, 'DECOY-CONTENT-OUTSIDE');
      // '../secret' relativo a BLOB_DIR apunta a un hermano; se coloca el señuelo allí también
      const sibling = path.join(path.dirname(blobDir), 'secret');
      fs.writeFileSync(sibling, 'DECOY-CONTENT-SIBLING');
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        const evil = kind === 'ABS' ? decoyPath : '../secret';
        const id = crypto.randomUUID();
        const fakeRepo = {
          ...repo,
          findById: () => ({
            uploadId: id,
            userId: USER_A,
            storedFilename: evil,
            mimeType: 'image/jpeg',
            sizeBytes: 1,
          }),
        } as unknown as UploadRepository;
        const fakeApp = createApp({
          db,
          repo: fakeRepo,
          claudeClient: claude,
          signingKey: KEY,
          now: () => clock,
        });
        const res = await request(fakeApp).get(
          signThumbnailUrl({ uploadId: id, key: KEY, nowMs: T0 })
        );
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ data: null, error: 'Failed to read file', status: 500 });
        expect(res.text).not.toContain('DECOY');
      } finally {
        errSpy.mockRestore();
        fs.rmSync(sibling, { force: true });
      }
    }
  );

  describe('clave obligatoria y rutas protegidas', () => {
    const origKey = process.env.THUMBNAIL_SIGNING_KEY;
    afterEach(() => {
      if (origKey === undefined) delete process.env.THUMBNAIL_SIGNING_KEY;
      else process.env.THUMBNAIL_SIGNING_KEY = origKey;
    });

    it('createApp lanza sin clave', () => {
      delete process.env.THUMBNAIL_SIGNING_KEY;
      expect(() => createApp({ db, repo })).toThrow();
    });
    it('createApp lanza con clave de 31 caracteres y no con 32', () => {
      expect(() => createApp({ db, repo, signingKey: 'k'.repeat(31) })).toThrow();
      expect(() => createApp({ db, repo, signingKey: 'k'.repeat(32) })).not.toThrow();
    });
    it('toma la clave de process.env.THUMBNAIL_SIGNING_KEY si no se inyecta', () => {
      process.env.THUMBNAIL_SIGNING_KEY = 'k'.repeat(40);
      expect(() => createApp({ db, repo })).not.toThrow();
    });
    it('POST y GET detalle sin JWT → 401 unauthenticated; /health público', async () => {
      const p = await request(app).post('/api/uploads');
      expect(p.status).toBe(401);
      expect(p.body).toEqual({ data: null, error: 'unauthenticated', status: 401 });
      const g = await request(app).get(`/api/uploads/${crypto.randomUUID()}`);
      expect(g.status).toBe(401);
      expect(g.body).toEqual({ data: null, error: 'unauthenticated', status: 401 });
      expect((await request(app).get('/health')).status).toBe(200);
    });
  });

  it('los logs no filtran sig=, la clave ni la URL completa (emisión y servido)', async () => {
    const spies = (['log', 'warn', 'error'] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined)
    );
    try {
      const { id, thumb } = await issue();
      await request(app).get(thumb);
      await request(app).get(thumb.slice(0, -1) + (thumb.endsWith('0') ? '1' : '0'));
      fs.rmSync(path.join(blobDir, repo.findById(id)!.storedFilename));
      await request(app).get(thumb);
      const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
      expect(logged).not.toContain('sig=');
      expect(logged).not.toContain(KEY);
      expect(logged).not.toContain(thumb);
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });
});
