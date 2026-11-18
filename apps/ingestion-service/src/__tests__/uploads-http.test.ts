import os from 'os';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import {
  ClaudeVisionResponse,
  UploadResultSchema,
  UploadDetailSchema,
  UploadListSchema,
} from '@proyecto/shared-types';
import { AnthropicIntegrationError } from '../service/anthropic-error';
import { createDatabase } from '../service/database';
import { createUploadRepository } from '../service/upload-repository';
import { createApp } from '../server';

const TEST_SIGNING_SECRET = 'a-test-secret-for-tests-only';
const TEST_SIGNING_KEY = 'test-only-signing-key-0123456789abcdef';
const TEST_USER_ID = 'user-test-abc-123';

/** Crea un JWT firmado con el secret de test para simular usuario autenticado. */
function makeJwt(userId: string = TEST_USER_ID): string {
  return jwt.sign({ sub: userId }, TEST_SIGNING_SECRET, { algorithm: 'HS256', expiresIn: '7d' });
}

/** Buffer mínimo JPEG válido (firma FF D8 FF E0 + padding). */
function minimalJpegBuffer(size: number = 10): Buffer {
  const buf = Buffer.alloc(size, 0x00);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  buf[3] = 0xe0;
  return buf;
}

/** Buffer mínimo PDF (25 50 44 46 ...) — para simular archivo malicioso. */
function pdfMagicBuffer(): Buffer {
  const buf = Buffer.alloc(20, 0x00);
  buf[0] = 0x25; // %
  buf[1] = 0x50; // P
  buf[2] = 0x44; // D
  buf[3] = 0x46; // F
  return buf;
}

/** Respuesta stub del cliente Claude Vision para usar en tests (evita llamadas a la red). */
const STUB_CLAUDE_RESPONSE: ClaudeVisionResponse = {
  confidence: 'HIGH',
  categories: [
    {
      id: 'CAT-1',
      name: 'Composition',
      score: 72,
      feedback: 'Good composition overall. Try applying rule of thirds for stronger impact.',
    },
    {
      id: 'CAT-2',
      name: 'Proportions',
      score: 68,
      feedback: 'Proportions are mostly accurate. Minor discrepancies in figure anatomy.',
    },
    {
      id: 'CAT-3',
      name: 'Line Quality',
      score: 75,
      feedback: 'Confident line work. Vary line weight more for greater depth.',
    },
    {
      id: 'CAT-4',
      name: 'Values (Shading)',
      score: 60,
      feedback: 'Basic shading present. Expand value range for stronger contrast.',
    },
    {
      id: 'CAT-5',
      name: 'Perspective',
      score: 55,
      feedback:
        'Perspective intent is clear. Establish consistent vanishing points before detailing.',
    },
  ],
};

/** Stub del cliente Claude Vision que devuelve datos fijos sin llamar a la red. */
const claudeClientStub = jest.fn().mockResolvedValue(STUB_CLAUDE_RESPONSE);

describe('POST /api/uploads', () => {
  let db: ReturnType<typeof createDatabase>;
  let repo: ReturnType<typeof createUploadRepository>;
  let app: ReturnType<typeof createApp>;
  let tmpBlobDir: string;

  const originalJwtSecret = process.env.JWT_SECRET;
  const originalBlobDir = process.env.BLOB_DIR;

  beforeAll(() => {
    process.env.JWT_SECRET = TEST_SIGNING_SECRET;
    tmpBlobDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingestion-upload-test-'));
    process.env.BLOB_DIR = tmpBlobDir;

    db = createDatabase(':memory:');
    repo = createUploadRepository(db);
    // Inyectar el stub de claudeClient para evitar llamadas a la red en tests
    app = createApp({ db, repo, claudeClient: claudeClientStub, signingKey: TEST_SIGNING_KEY });
  });

  afterAll(() => {
    db.close();
    // Restaurar variables de entorno
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
    if (originalBlobDir === undefined) {
      delete process.env.BLOB_DIR;
    } else {
      process.env.BLOB_DIR = originalBlobDir;
    }
    // Limpiar tmpDir
    fs.rmSync(tmpBlobDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    claudeClientStub.mockClear();
  });

  // CA-7 (regresión u1-T01): 401 sin Authorization header
  // El literal exacto del campo error es "unauthenticated" (viene de @proyecto/auth-middleware)
  it('no auth header — responde 401 unauthenticated', async () => {
    const res = await request(app)
      .post('/api/uploads')
      .attach('file', minimalJpegBuffer(), { filename: 'test.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      data: null,
      error: 'unauthenticated', // requireAuth devuelve {error:"unauthenticated"}
      status: 401,
    });
  });

  it('token inválido — responde 401 unauthenticated', async () => {
    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', 'Bearer invalid.token.here')
      .attach('file', minimalJpegBuffer(), { filename: 'test.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthenticated');
  });

  // CA-6: happy path 202 con JPEG válido y respuesta C10 completa
  it('CA-6: happy path — JPEG válido + JWT válido → 202 con uploadId uuid, status ready, confidence HIGH, 5 categories', async () => {
    const countBefore = repo.countByUserId(TEST_USER_ID);
    const clientFilename = 'my-photo-from-client.jpg';
    const jpegBuf = minimalJpegBuffer(50);
    const token = makeJwt(TEST_USER_ID);

    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', jpegBuf, { filename: clientFilename, contentType: 'image/jpeg' });

    expect(res.status).toBe(202);
    expect(res.body.error).toBeNull();
    expect(res.body.status).toBe(202);
    expect(res.body.data).toBeDefined();

    // uploadId debe ser un UUID válido
    expect(res.body.data.uploadId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );

    // status debe ser "ready"
    expect(res.body.data.status).toBe('ready');

    // confidence debe ser "HIGH" (del stub)
    expect(res.body.data.confidence).toBe('HIGH');

    // categories: array de exactamente 5 elementos
    expect(Array.isArray(res.body.data.categories)).toBe(true);
    expect(res.body.data.categories.length).toBe(5);

    // Verificar estructura de cada categoría
    const categoryIds = res.body.data.categories
      .map((c: { categoryId: string }) => c.categoryId)
      .sort();
    expect(categoryIds).toEqual(['CAT-1', 'CAT-2', 'CAT-3', 'CAT-4', 'CAT-5']);

    for (const cat of res.body.data.categories) {
      expect(typeof cat.categoryId).toBe('string');
      expect(typeof cat.categoryName).toBe('string');
      expect(typeof cat.score).toBe('number');
      expect(cat.score).toBeGreaterThanOrEqual(0);
      expect(cat.score).toBeLessThanOrEqual(100);
      expect(typeof cat.feedback).toBe('string');
      expect(cat.feedback.length).toBeGreaterThan(0);
    }

    // Verificar BD: exactamente 1 fila nueva para este user_id
    expect(repo.countByUserId(TEST_USER_ID)).toBe(countBefore + 1);

    // Verificar que stored_filename difiere del filename del cliente
    const upload = repo.findById(res.body.data.uploadId);
    expect(upload).not.toBeNull();
    expect(upload?.storedFilename).not.toBe(clientFilename);
    expect(upload?.storedFilename).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}.*\.jpg$/);

    // Verificar que el claudeClient stub fue llamado una vez
    expect(claudeClientStub).toHaveBeenCalledTimes(1);
  });

  // CA-8 (regresión u1-T01): archivo > 10 MB responde 413
  it('too large — archivo de 10 MB + 1 byte → 413', async () => {
    const countBefore = repo.countAll();
    // 10 MiB + 1 byte
    const bigBuf = Buffer.alloc(10 * 1024 * 1024 + 1, 0xaa);
    const token = makeJwt();

    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', bigBuf, { filename: 'huge.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(413);
    expect(res.body.data).toBeNull();
    expect(res.body.status).toBe(413);

    // BD sin cambios: conteo igual al de antes
    expect(repo.countAll()).toBe(countBefore);
  });

  // CA-8 (regresión u1-T01): PDF renombrado con Content-Type: image/jpeg → 422 Invalid image format
  // El literal exacto del campo error es "Invalid image format" (AC-1.2)
  it('CA-8: magic-number rechaza PDF renombrado como .jpg con Content-Type image/jpeg → 422', async () => {
    const countBefore = repo.countAll();
    const pdfBuf = pdfMagicBuffer();
    const token = makeJwt();

    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', pdfBuf, { filename: 'trap.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      data: null,
      error: 'Invalid image format',
      status: 422,
    });

    // BD sin cambios
    expect(repo.countAll()).toBe(countBefore);
  });

  // Regresión: sin campo 'file' → 422
  it('no file field — POST sin campo file → 422 missing file', async () => {
    const token = makeJwt();

    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${token}`)
      .field('other_field', 'some_value');

    expect(res.status).toBe(422);
    expect(res.body.data).toBeNull();
    expect(res.body.status).toBe(422);
  });

  it('campo distinto a "file" — req.file undefined no explota, responde 422', async () => {
    const token = makeJwt();

    // Envía un campo llamado "imagen" en vez de "file" — multer no lo recoge
    // y req.file queda undefined. El handler debe responder 422 sin explotar.
    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${token}`)
      .attach('imagen', minimalJpegBuffer(), { filename: 'test.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(422);
  });

  // Error del cliente Claude → 500
  it('claudeClient error — falla en Claude → 500', async () => {
    claudeClientStub.mockRejectedValueOnce(new Error('Claude API error'));
    const token = makeJwt();

    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', minimalJpegBuffer(20), { filename: 'test.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(500);
    expect(res.body.status).toBe(500);
    expect(res.body.data).toBeNull();
    expect(res.body.error).toBe('Failed to analyze image');
  });
  // ---- u3: fallback de baja confianza ----
  const upJpeg = (token: string) =>
    request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', minimalJpegBuffer(30), { filename: 't.jpg', contentType: 'image/jpeg' });

  function expectFallback(res: request.Response, reason: string) {
    expect(res.status).toBe(202);
    expect(res.body.error).toBeNull();
    expect(res.body.status).toBe(202);
    expect(res.body.data.status).toBe('low_confidence');
    expect(res.body.data.confidence).toBe('LOW');
    expect(res.body.data.fallbackReason).toBe(reason);
    expect(res.body).not.toHaveProperty('data.categories');
    expect(UploadResultSchema.safeParse(res.body).success).toBe(true);
  }

  it('LOW confidence — 202 low_confidence con fallbackReason low_confidence_flag y sin categories', async () => {
    claudeClientStub.mockResolvedValueOnce({ ...STUB_CLAUDE_RESPONSE, confidence: 'LOW' });
    expectFallback(await upJpeg(makeJwt()), 'low_confidence_flag');
  });

  it('LOW confidence — el upload queda registrado en BD (persisted, findById / countByUserId)', async () => {
    const userId = 'user-low-persist';
    claudeClientStub.mockResolvedValueOnce({ ...STUB_CLAUDE_RESPONSE, confidence: 'LOW' });
    const res = await upJpeg(makeJwt(userId));
    expectFallback(res, 'low_confidence_flag');
    expect(repo.countByUserId(userId)).toBe(1);
    expect(repo.findById(res.body.data.uploadId)).not.toBeNull();
  });

  it('invalid_schema — menos de 5 categorías → 202 fallback invalid_schema', async () => {
    claudeClientStub.mockResolvedValueOnce({
      ...STUB_CLAUDE_RESPONSE,
      categories: STUB_CLAUDE_RESPONSE.categories.slice(0, 4),
    });
    expectFallback(await upJpeg(makeJwt()), 'invalid_schema');
  });

  it('invalid_schema — score 150 → 202 fallback invalid_schema', async () => {
    const cats = STUB_CLAUDE_RESPONSE.categories.map((c, i) =>
      i === 0 ? { ...c, score: 150 } : c
    );
    claudeClientStub.mockResolvedValueOnce({ ...STUB_CLAUDE_RESPONSE, categories: cats });
    expectFallback(await upJpeg(makeJwt()), 'invalid_schema');
  });

  it('timeout — AnthropicIntegrationError timeout → fallbackReason timeout', async () => {
    claudeClientStub.mockRejectedValueOnce(new AnthropicIntegrationError('timeout', 'slow'));
    expectFallback(await upJpeg(makeJwt()), 'timeout');
  });

  it('network — AnthropicIntegrationError network → fallbackReason timeout (D-1)', async () => {
    claudeClientStub.mockRejectedValueOnce(new AnthropicIntegrationError('network', 'down'));
    expectFallback(await upJpeg(makeJwt()), 'timeout');
  });

  it('bad-response — AnthropicIntegrationError bad-response → fallbackReason invalid_schema', async () => {
    claudeClientStub.mockRejectedValueOnce(new AnthropicIntegrationError('bad-response', 'junk'));
    expectFallback(await upJpeg(makeJwt()), 'invalid_schema');
  });

  it('MEDIUM válido — 202 ready con 5 categories (no es fallback)', async () => {
    claudeClientStub.mockResolvedValueOnce({ ...STUB_CLAUDE_RESPONSE, confidence: 'MEDIUM' });
    const res = await upJpeg(makeJwt());
    expect(res.status).toBe(202);
    expect(res.body.data.status).toBe('ready');
    expect(res.body.data.confidence).toBe('MEDIUM');
    expect(res.body.data.categories).toHaveLength(5);
    expect(res.body.data).not.toHaveProperty('fallbackReason');
  });

  it('log de fallback — console.warn solo lleva uploadId y reason (sin buffer ni texto de Claude)', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      claudeClientStub.mockResolvedValueOnce({
        ...STUB_CLAUDE_RESPONSE,
        confidence: 'LOW',
        secretRaw: 'RAW-CLAUDE-TEXT',
      });
      const res = await upJpeg(makeJwt());
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]).toHaveLength(1);
      expect(warn.mock.calls[0][0]).toBe(
        `[uploads] low_confidence uploadId=${res.body.data.uploadId} reason=low_confidence_flag`
      );
    } finally {
      warn.mockRestore();
    }
  });
});

// ---- u4-T01: persistencia de la crítica y GET /api/uploads/:uploadId ----
describe('u4: persistencia y GET /api/uploads/:uploadId', () => {
  let db: ReturnType<typeof createDatabase>;
  let repo: ReturnType<typeof createUploadRepository>;
  let app: ReturnType<typeof createApp>;
  let tmpBlobDir: string;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalBlobDir = process.env.BLOB_DIR;
  const USER_A = 'user-a-u4';
  const USER_B = 'user-b-u4';
  const USER_C = 'user-c-u4';
  const NOT_FOUND = { data: null, error: 'Not Found', status: 404 };

  beforeAll(() => {
    process.env.JWT_SECRET = TEST_SIGNING_SECRET;
    tmpBlobDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingestion-u4-test-'));
    process.env.BLOB_DIR = tmpBlobDir;
    db = createDatabase(':memory:');
    repo = createUploadRepository(db);
    app = createApp({ db, repo, claudeClient: claudeClientStub, signingKey: TEST_SIGNING_KEY });
  });

  afterAll(() => {
    db.close();
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
    if (originalBlobDir === undefined) delete process.env.BLOB_DIR;
    else process.env.BLOB_DIR = originalBlobDir;
    fs.rmSync(tmpBlobDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    claudeClientStub.mockReset();
    claudeClientStub.mockResolvedValue(STUB_CLAUDE_RESPONSE);
  });

  const post = (userId: string, appUnderTest = app) =>
    request(appUnderTest)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${makeJwt(userId)}`)
      .attach('file', minimalJpegBuffer(30), { filename: 't.jpg', contentType: 'image/jpeg' });

  const get = (id: string, userId?: string) => {
    const r = request(app).get(`/api/uploads/${id}`);
    return userId ? r.set('Authorization', `Bearer ${makeJwt(userId)}`) : r;
  };

  const critiqueRows = (uploadId: string) =>
    db
      .prepare(
        'SELECT category_id, category_name, score, feedback FROM category_critiques WHERE upload_id = ? ORDER BY category_id'
      )
      .all(uploadId) as {
      category_id: string;
      category_name: string;
      score: number;
      feedback: string;
    }[];

  it.each(['HIGH', 'MEDIUM'] as const)(
    'persist: POST %s guarda status ready, confidence y 5 filas en category_critiques',
    async (confidence) => {
      claudeClientStub.mockResolvedValueOnce({ ...STUB_CLAUDE_RESPONSE, confidence });
      const res = await post(USER_A);
      expect(res.status).toBe(202);
      expect(UploadResultSchema.safeParse(res.body).success).toBe(true);
      const id = res.body.data.uploadId;
      const row = db
        .prepare('SELECT status, confidence, fallback_reason FROM uploads WHERE upload_id = ?')
        .get(id) as { status: string; confidence: string; fallback_reason: string | null };
      expect(row).toEqual({ status: 'ready', confidence, fallback_reason: null });
      const rows = critiqueRows(id);
      expect(rows).toHaveLength(5);
      for (const c of res.body.data.categories) {
        const r = rows.find((x) => x.category_id === c.categoryId);
        expect(r).toMatchObject({
          category_name: c.categoryName,
          score: c.score,
          feedback: c.feedback,
        });
      }
    }
  );

  it.each([
    ['low_confidence_flag', () => ({ ...STUB_CLAUDE_RESPONSE, confidence: 'LOW' as const })],
    ['invalid_schema', () => ({ ...STUB_CLAUDE_RESPONSE, categories: [] })],
  ])('persist: fallback %s deja low_confidence, fallback_reason y 0 filas', async (reason, mk) => {
    claudeClientStub.mockResolvedValueOnce(mk());
    const res = await post(USER_A);
    expect(res.status).toBe(202);
    expect(res.body.data.fallbackReason).toBe(reason);
    expect(res.body).not.toHaveProperty('data.categories');
    const id = res.body.data.uploadId;
    const row = db
      .prepare('SELECT status, confidence, fallback_reason FROM uploads WHERE upload_id = ?')
      .get(id);
    expect(row).toEqual({ status: 'low_confidence', confidence: 'LOW', fallback_reason: reason });
    expect(critiqueRows(id)).toHaveLength(0);
  });

  it('persist: fallback timeout deja low_confidence, fallback_reason timeout y 0 filas', async () => {
    claudeClientStub.mockRejectedValueOnce(new AnthropicIntegrationError('timeout', 'x'));
    const res = await post(USER_A);
    expect(res.body.data.fallbackReason).toBe('timeout');
    const id = res.body.data.uploadId;
    expect(
      db.prepare('SELECT status, fallback_reason FROM uploads WHERE upload_id = ?').get(id)
    ).toEqual({ status: 'low_confidence', fallback_reason: 'timeout' });
    expect(critiqueRows(id)).toHaveLength(0);
  });

  it('Failed to store critique: si saveCritique lanza → 500 y el log no expone buffer ni claves', async () => {
    const failingRepo = {
      ...repo,
      saveCritique: () => {
        throw new Error('disk full SECRET-TOKEN');
      },
    };
    const failApp = createApp({
      db,
      repo: failingRepo,
      claudeClient: claudeClientStub,
      signingKey: TEST_SIGNING_KEY,
    });
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const res = await post(USER_A, failApp);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ data: null, error: 'Failed to store critique', status: 500 });
      const logged = JSON.stringify([...errSpy.mock.calls, ...warnSpy.mock.calls]);
      expect(logged).not.toContain('SECRET-TOKEN');
    } finally {
      errSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('GET 200 del dueño (UploadDetail): categories iguales a las del POST, timestamp con Z, con thumbnailUrl firmada', async () => {
    const created = await post(USER_A);
    const res = await get(created.body.data.uploadId, USER_A);
    expect(res.status).toBe(200);
    expect(UploadDetailSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.data.categories).toEqual(created.body.data.categories);
    expect(res.body.data.categories.map((c: { categoryId: string }) => c.categoryId)).toEqual([
      'CAT-1',
      'CAT-2',
      'CAT-3',
      'CAT-4',
      'CAT-5',
    ]);
    expect(res.body.data.timestamp).toMatch(/Z$/);
    expect(res.body.data.status).toBe('ready');
    expect(res.body.data.confidence).toBe('HIGH');
    expect(res.body.data.thumbnailUrl).toMatch(
      new RegExp(
        `^/api/uploads/${created.body.data.uploadId}/thumbnail\\?exp=\\d+&sig=[0-9a-f]{64}$`
      )
    );
    expect(res.body.data).not.toHaveProperty('fallbackReason');
  });

  it('GET 403 Forbidden a otro usuario y a un tercero: sin ningún dato del upload (AC-4.1)', async () => {
    const created = await post(USER_A);
    const id = created.body.data.uploadId;
    for (const other of [USER_B, USER_C]) {
      const res = await get(id, other);
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ data: null, error: 'Forbidden', status: 403 });
      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain(id);
      for (const c of created.body.data.categories) {
        expect(raw).not.toContain(c.feedback);
        expect(raw).not.toContain(`"score":${c.score}`);
      }
    }
  });

  it('GET 403: no se ejecuta ningún SELECT sobre category_critiques antes de decidir el dueño (F-01)', async () => {
    // BD y repo propios: se envuelve db.prepare ANTES de crear el repo para registrar el SQL ejecutado.
    const spyDb = createDatabase(':memory:');
    const executed: string[] = [];
    const realPrepare = spyDb.prepare.bind(spyDb) as (sql: string) => unknown;
    jest.spyOn(spyDb, 'prepare').mockImplementation(((sql: string) => {
      const stmt = realPrepare(sql) as Record<string, unknown>;
      return new Proxy(stmt, {
        get(target, prop) {
          const v = target[prop as string];
          if (typeof v === 'function' && ['get', 'all', 'run', 'iterate'].includes(String(prop))) {
            return (...args: unknown[]) => {
              executed.push(sql);
              return (v as (...a: unknown[]) => unknown).apply(target, args);
            };
          }
          return typeof v === 'function' ? v.bind(target) : v;
        },
      });
    }) as never);
    const spyRepo = createUploadRepository(spyDb);
    const spyApp = createApp({
      db: spyDb,
      repo: spyRepo,
      claudeClient: claudeClientStub,
      signingKey: TEST_SIGNING_KEY,
    });
    try {
      const created = await post(USER_A, spyApp);
      const id = created.body.data.uploadId;

      executed.length = 0;
      const owner = await request(spyApp)
        .get(`/api/uploads/${id}`)
        .set('Authorization', `Bearer ${makeJwt(USER_A)}`);
      expect(owner.status).toBe(200);
      // sanity: para el dueño sí se leen las categorías
      expect(executed.some((q) => q.includes('category_critiques'))).toBe(true);

      executed.length = 0;
      const intruder = await request(spyApp)
        .get(`/api/uploads/${id}`)
        .set('Authorization', `Bearer ${makeJwt(USER_B)}`);
      expect(intruder.status).toBe(403);
      expect(executed.length).toBeGreaterThan(0);
      expect(executed.filter((q) => q.includes('category_critiques'))).toEqual([]);
    } finally {
      jest.restoreAllMocks();
      spyDb.close();
    }
  });

  it('GET 404 Not Found: UUID inexistente, ids que no son UUID y upload propio sin crítica', async () => {
    const missing = await get(crypto.randomUUID(), USER_A);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual(NOT_FOUND);
    // Nota: '../etc/passwd' CRUDO lo normaliza el cliente HTTP (la ruta resultante ya no es
    // /api/uploads/:uploadId) y lo atiende el 404 global; por eso aquí se prueba la forma
    // codificada (%2F), que sí llega al handler como parámetro. Se añade también la cruda.
    for (const bad of ['abc', '..%2Fetc%2Fpasswd', '../etc/passwd', '123']) {
      const res = await get(bad, USER_A);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(NOT_FOUND);
    }
    const bare = repo.create({
      userId: USER_A,
      storedFilename: 'x.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1,
    });
    const res = await get(bare.uploadId, USER_A);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(NOT_FOUND);
  });

  it('GET 401 unauthenticated sin Authorization', async () => {
    const res = await get(crypto.randomUUID());
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ data: null, error: 'unauthenticated', status: 401 });
  });

  it('GET low_confidence / fallback del dueño → 200 con fallbackReason y sin categories', async () => {
    claudeClientStub.mockResolvedValueOnce({ ...STUB_CLAUDE_RESPONSE, confidence: 'LOW' });
    const created = await post(USER_A);
    const res = await get(created.body.data.uploadId, USER_A);
    expect(res.status).toBe(200);
    expect(UploadDetailSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.data.status).toBe('low_confidence');
    expect(res.body.data.confidence).toBe('LOW');
    expect(res.body.data.fallbackReason).toBe('low_confidence_flag');
    expect(res.body).not.toHaveProperty('data.categories');
  });
});

describe('u5: GET /api/uploads (listado del usuario)', () => {
  let db: ReturnType<typeof createDatabase>;
  let repo: ReturnType<typeof createUploadRepository>;
  let app: ReturnType<typeof createApp>;
  let tmpBlobDir: string;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalBlobDir = process.env.BLOB_DIR;
  const USER_A = 'user-a-u5';
  const USER_B = 'user-b-u5';
  const USER_C = 'user-c-u5';
  const FORBIDDEN_KEYS = [
    'userId',
    'user_id',
    'storedFilename',
    'stored_filename',
    'mimeType',
    'sizeBytes',
    'feedback',
    'categoryName',
    'thumbnailUrl',
    'sig=',
  ];

  beforeAll(() => {
    process.env.JWT_SECRET = TEST_SIGNING_SECRET;
    tmpBlobDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingestion-u5-test-'));
    process.env.BLOB_DIR = tmpBlobDir;
  });

  afterAll(() => {
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
    if (originalBlobDir === undefined) delete process.env.BLOB_DIR;
    else process.env.BLOB_DIR = originalBlobDir;
    fs.rmSync(tmpBlobDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    db = createDatabase(':memory:');
    repo = createUploadRepository(db);
    app = createApp({ db, repo, claudeClient: claudeClientStub, signingKey: TEST_SIGNING_KEY });
    claudeClientStub.mockReset();
    claudeClientStub.mockResolvedValue(STUB_CLAUDE_RESPONSE);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    db.close();
  });

  const post = (userId: string) =>
    request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${makeJwt(userId)}`)
      .attach('file', minimalJpegBuffer(30), { filename: 't.jpg', contentType: 'image/jpeg' });

  const list = (userId?: string, query = '') => {
    const r = request(app).get(`/api/uploads${query}`);
    return userId ? r.set('Authorization', `Bearer ${makeJwt(userId)}`) : r;
  };

  /** Fija timestamps distintos para que el orden esperado no dependa del reloj. */
  const setTs = (uploadId: string, ts: string) =>
    db.prepare('UPDATE uploads SET timestamp = ? WHERE upload_id = ?').run(ts, uploadId);

  it('GET /api/uploads: listado de A con dos uploads (ready y fallback), más reciente primero, pasa UploadListSchema', async () => {
    const first = await post(USER_A);
    claudeClientStub.mockRejectedValueOnce(new AnthropicIntegrationError('timeout', 'slow'));
    const second = await post(USER_A);
    const idFirst = first.body.data.uploadId;
    const idSecond = second.body.data.uploadId;
    setTs(idFirst, '2026-05-01 10:00:00');
    setTs(idSecond, '2026-05-02 10:00:00');
    await post(USER_B);

    const res = await list(USER_A);
    expect(res.status).toBe(200);
    expect(UploadListSchema.safeParse(res.body).success).toBe(true);
    const items = res.body.data.items;
    expect(items).toHaveLength(2);
    expect(items.map((i: { uploadId: string }) => i.uploadId)).toEqual([idSecond, idFirst]);
    expect(items[0]).toMatchObject({
      status: 'low_confidence',
      scores: [],
      fallbackReason: 'timeout',
    });
    expect(items[1].status).toBe('ready');
    expect(items[1].scores).toHaveLength(5);
    expect(items[1]).not.toHaveProperty('fallbackReason');
  });

  it('GET /api/uploads: B ve solo lo suyo y el listado vacío da 200 con items []', async () => {
    await post(USER_A);
    const b = await post(USER_B);
    const resB = await list(USER_B);
    expect(resB.body.data.items.map((i: { uploadId: string }) => i.uploadId)).toEqual([
      b.body.data.uploadId,
    ]);
    const resC = await list(USER_C);
    expect(resC.status).toBe(200);
    expect(resC.body).toEqual({ data: { items: [] }, error: null, status: 200 });
    expect(UploadListSchema.safeParse(resC.body).success).toBe(true);
  });

  it('GET /api/uploads: no se confunde con el detalle (no responde 404 Not Found)', async () => {
    const res = await list(USER_C);
    expect(res.status).not.toBe(404);
    expect(res.body.error).toBeNull();
  });

  it('aislamiento: B no ve nada de A con ?userId, ?user_id ni ?uploadId de A, y el repo recibe el userId del token', async () => {
    const a1 = await post(USER_A);
    await post(USER_A);
    const b = await post(USER_B);
    const idA = a1.body.data.uploadId;
    const spy = jest.spyOn(repo, 'listByUser');
    for (const q of [`?userId=${USER_A}`, `?user_id=${USER_A}`, `?uploadId=${idA}`]) {
      spy.mockClear();
      const res = await list(USER_B, q);
      expect(res.status).toBe(200);
      expect(res.body.data.items.map((i: { uploadId: string }) => i.uploadId)).toEqual([
        b.body.data.uploadId,
      ]);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(USER_B);
    }
  });

  it('no expone ni filtra campos prohibidos ni el userId de otro usuario', async () => {
    await post(USER_A);
    await post(USER_B);
    const body = JSON.stringify((await list(USER_B)).body);
    for (const k of FORBIDDEN_KEYS) expect(body).not.toContain(k);
    expect(body).not.toContain(USER_A);
    expect(body).not.toContain(USER_B);
  });

  it('401: sin JWT, con JWT mal firmado y con JWT expirado', async () => {
    const noAuth = await list();
    expect(noAuth.status).toBe(401);
    expect(noAuth.body).toEqual({ data: null, error: 'unauthenticated', status: 401 });
    const bad = jwt.sign({ sub: USER_A }, 'otro-secret-distinto', { algorithm: 'HS256' });
    const resBad = await request(app).get('/api/uploads').set('Authorization', `Bearer ${bad}`);
    expect(resBad.status).toBe(401);
    const expired = jwt.sign({ sub: USER_A }, TEST_SIGNING_SECRET, {
      algorithm: 'HS256',
      expiresIn: -10,
    });
    const resExp = await request(app).get('/api/uploads').set('Authorization', `Bearer ${expired}`);
    expect(resExp.status).toBe(401);
  });

  it('500: fallo del repo responde Failed to list uploads y el log no contiene userId ni datos', async () => {
    jest.spyOn(repo, 'listByUser').mockImplementation(() => {
      throw new Error(`boom ${USER_A} secreto-interno`);
    });
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await list(USER_A);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ data: null, error: 'Failed to list uploads', status: 500 });
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalledWith('[uploads] failed to list');
    expect(JSON.stringify(errSpy.mock.calls)).not.toContain(USER_A);
    expect(JSON.stringify(errSpy.mock.calls)).not.toContain('secreto-interno');
  });

  it('GET /:uploadId sigue respondiendo el detalle tras añadir el listado', async () => {
    const a = await post(USER_A);
    const res = await request(app)
      .get(`/api/uploads/${a.body.data.uploadId}`)
      .set('Authorization', `Bearer ${makeJwt(USER_A)}`);
    expect(res.status).toBe(200);
    expect(UploadDetailSchema.safeParse(res.body).success).toBe(true);
  });
});
