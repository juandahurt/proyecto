import request from 'supertest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createApp } from '../server';
import { createDatabase } from '../service/database';
import { createUploadRepository } from '../service/upload-repository';

const VALID_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const OTHER_UUID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

function url(userId: string): string {
  return `/api/internal/users/${userId}/data`;
}

describe('DELETE /api/internal/users/:userId/data', () => {
  let tmpDir: string;
  let db: ReturnType<typeof createDatabase>;
  let repo: ReturnType<typeof createUploadRepository>;
  let app: ReturnType<typeof createApp>;
  const originalBlobDir = process.env.BLOB_DIR;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingestion-delete-test-'));
    process.env.BLOB_DIR = tmpDir;
    process.env.THUMBNAIL_SIGNING_KEY = 'a'.repeat(32);
    db = createDatabase(':memory:');
    repo = createUploadRepository(db);
    app = createApp({ db, repo, identityUrl: 'http://identity-test.invalid' });
  });

  afterEach(() => {
    db.close();
    if (originalBlobDir === undefined) {
      delete process.env.BLOB_DIR;
    } else {
      process.env.BLOB_DIR = originalBlobDir;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createUploadWithBlob(userId: string, storedFilename: string): string {
    const upload = repo.create({ userId, storedFilename, mimeType: 'image/jpeg', sizeBytes: 10 });
    fs.writeFileSync(path.join(tmpDir, storedFilename), Buffer.from('fake-image'));
    return upload.uploadId;
  }

  it('CA-2: usuario con 2 uploads (ready + low_confidence) -> 204, BD y blobs borrados', async () => {
    const readyId = createUploadWithBlob(VALID_UUID, 'ready-blob.jpg');
    db.prepare("UPDATE uploads SET confidence = 'HIGH', status = 'ready' WHERE upload_id = ?").run(
      readyId
    );
    db.prepare(
      'INSERT INTO category_critiques (critique_id, upload_id, category_id, category_name, score, feedback) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('crit-1', readyId, 'CAT-1', 'Composition', 80, 'good');

    const fallbackId = createUploadWithBlob(VALID_UUID, 'fallback-blob.jpg');
    db.prepare(
      "UPDATE uploads SET confidence = 'LOW', status = 'low_confidence', fallback_reason = 'blurry' WHERE upload_id = ?"
    ).run(fallbackId);

    const res = await request(app).delete(url(VALID_UUID));
    expect(res.status).toBe(204);

    expect(repo.listByUser(VALID_UUID)).toEqual([]);
    expect(repo.findById(readyId)).toBeNull();
    expect(repo.findById(fallbackId)).toBeNull();

    const critiqueCount = (
      db
        .prepare('SELECT COUNT(*) as c FROM category_critiques WHERE upload_id = ?')
        .get(readyId) as {
        c: number;
      }
    ).c;
    expect(critiqueCount).toBe(0);

    expect(fs.existsSync(path.join(tmpDir, 'ready-blob.jpg'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'fallback-blob.jpg'))).toBe(false);
  });

  it('CA-2: no toca uploads de otro usuario', async () => {
    const otherId = createUploadWithBlob(OTHER_UUID, 'other-blob.jpg');
    db.prepare("UPDATE uploads SET confidence = 'HIGH', status = 'ready' WHERE upload_id = ?").run(
      otherId
    );

    const myId = createUploadWithBlob(VALID_UUID, 'mine-blob.jpg');
    db.prepare("UPDATE uploads SET confidence = 'HIGH', status = 'ready' WHERE upload_id = ?").run(
      myId
    );

    const res = await request(app).delete(url(VALID_UUID));
    expect(res.status).toBe(204);

    expect(repo.findById(myId)).toBeNull();
    expect(repo.findById(otherId)).not.toBeNull();
    expect(fs.existsSync(path.join(tmpDir, 'other-blob.jpg'))).toBe(true);
  });

  it('CA-2: usuario sin uploads -> 204 (idempotente)', async () => {
    const res = await request(app).delete(url(VALID_UUID));
    expect(res.status).toBe(204);
  });

  it('CA-2: userId que no es UUID -> 204 (network-trusted, nada que borrar)', async () => {
    const res = await request(app).delete(url('not-a-valid-uuid'));
    expect(res.status).toBe(204);
  });

  it('CA-2 mutación: filas huérfanas de category_critiques harían fallar este test', async () => {
    const readyId = createUploadWithBlob(VALID_UUID, 'ready-blob-2.jpg');
    db.prepare("UPDATE uploads SET confidence = 'HIGH', status = 'ready' WHERE upload_id = ?").run(
      readyId
    );
    db.prepare(
      'INSERT INTO category_critiques (critique_id, upload_id, category_id, category_name, score, feedback) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('crit-2', readyId, 'CAT-1', 'Composition', 80, 'good');

    await request(app).delete(url(VALID_UUID));

    const row = db.prepare('SELECT * FROM category_critiques WHERE upload_id = ?').get(readyId);
    expect(row).toBeUndefined();
  });
});
