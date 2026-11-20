import request from 'supertest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createApp } from '../server';
import { createDatabase } from '../service/database';
import { createUploadRepository } from '../service/upload-repository';

const VALID_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

describe('DELETE /api/internal/users/:userId/data — fallo de archivo no aborta BD', () => {
  let tmpDir: string;
  let db: ReturnType<typeof createDatabase>;
  let repo: ReturnType<typeof createUploadRepository>;
  const originalBlobDir = process.env.BLOB_DIR;
  let unlinkSpy: jest.SpyInstance;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingestion-delete-fail-test-'));
    process.env.BLOB_DIR = tmpDir;
    process.env.THUMBNAIL_SIGNING_KEY = 'a'.repeat(32);
    db = createDatabase(':memory:');
    repo = createUploadRepository(db);
    consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    unlinkSpy.mockRestore();
    consoleSpy.mockRestore();
    db.close();
    if (originalBlobDir === undefined) {
      delete process.env.BLOB_DIR;
    } else {
      process.env.BLOB_DIR = originalBlobDir;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('CA-3: unlink falla para un blob, el otro se borra, BD de ambos uploads queda limpia, sin userId/ruta en logs', async () => {
    const failId = repo.create({
      userId: VALID_UUID,
      storedFilename: 'will-fail.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 10,
    }).uploadId;
    db.prepare("UPDATE uploads SET confidence = 'HIGH', status = 'ready' WHERE upload_id = ?").run(
      failId
    );
    fs.writeFileSync(path.join(tmpDir, 'will-fail.jpg'), Buffer.from('x'));

    const okId = repo.create({
      userId: VALID_UUID,
      storedFilename: 'will-succeed.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 10,
    }).uploadId;
    db.prepare("UPDATE uploads SET confidence = 'HIGH', status = 'ready' WHERE upload_id = ?").run(
      okId
    );
    fs.writeFileSync(path.join(tmpDir, 'will-succeed.jpg'), Buffer.from('y'));

    const realUnlink = fs.promises.unlink.bind(fs.promises);
    unlinkSpy = jest.spyOn(fs.promises, 'unlink').mockImplementation(async (p: fs.PathLike) => {
      if (String(p).includes('will-fail.jpg')) {
        throw new Error('EACCES: permission denied, unlink');
      }
      return realUnlink(p);
    });

    const app = createApp({ db, repo, identityUrl: 'http://identity-test.invalid' });
    const res = await request(app).delete(`/api/internal/users/${VALID_UUID}/data`);

    expect(res.status).toBe(204);
    expect(repo.findById(failId)).toBeNull();
    expect(repo.findById(okId)).toBeNull();

    for (const call of consoleSpy.mock.calls) {
      const joined = call.join(' ');
      expect(joined).not.toContain(VALID_UUID);
      expect(joined).not.toContain('will-fail.jpg');
      expect(joined).not.toContain(tmpDir);
    }
  });
});
