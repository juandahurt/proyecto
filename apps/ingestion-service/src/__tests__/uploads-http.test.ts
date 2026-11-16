import os from 'os';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import jwt from 'jsonwebtoken';
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
    app = createApp({ db, repo });
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

  // CA-8: 401 sin Authorization header
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

  // CA-9: happy path 202 con JPEG válido
  it('happy path — JPEG válido + JWT válido → 202 con uploadId uuid', async () => {
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
    expect(res.body.data.uploadId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );

    // Verificar BD: exactamente 1 fila nueva para este user_id
    expect(repo.countByUserId(TEST_USER_ID)).toBe(countBefore + 1);

    // Verificar que stored_filename difiere del filename del cliente
    const upload = repo.findById(res.body.data.uploadId);
    expect(upload).not.toBeNull();
    expect(upload?.storedFilename).not.toBe(clientFilename);
    expect(upload?.storedFilename).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}.*\.jpg$/);
  });

  // CA-10: archivo > 10 MB responde 413
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

  // CA-11: PDF renombrado con Content-Type: image/jpeg → 422 Invalid image format
  // El literal exacto del campo error es "Invalid image format" (AC-1.2)
  it('magic-number rechaza PDF renombrado como .jpg con Content-Type image/jpeg → 422', async () => {
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

  // CA-12: sin campo 'file' → 422
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
});
