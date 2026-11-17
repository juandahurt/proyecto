import os from 'os';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { ClaudeVisionResponse, UploadResultSchema } from '@proyecto/shared-types';
import { AnthropicIntegrationError } from '../service/anthropic-error';
import { createDatabase } from '../service/database';
import { createUploadRepository } from '../service/upload-repository';
import { createApp } from '../server';

const TEST_SIGNING_SECRET = 'a-test-secret-for-tests-only';
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
    app = createApp({ db, repo, claudeClient: claudeClientStub });
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
});
