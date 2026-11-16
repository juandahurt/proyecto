import { createDatabase } from '../service/database';
import { createUploadRepository } from '../service/upload-repository';

describe('UploadRepository', () => {
  let db: ReturnType<typeof createDatabase>;
  let repo: ReturnType<typeof createUploadRepository>;

  beforeEach(() => {
    db = createDatabase(':memory:');
    repo = createUploadRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('create', () => {
    it('crea un upload y devuelve un Upload con uploadId uuid server-side', () => {
      const upload = repo.create({
        userId: 'user-123',
        storedFilename: 'abc-uuid.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
      });

      expect(upload.uploadId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      expect(upload.userId).toBe('user-123');
      expect(upload.storedFilename).toBe('abc-uuid.jpg');
      expect(upload.mimeType).toBe('image/jpeg');
      expect(upload.sizeBytes).toBe(1024);
      expect(upload.confidence).toBeNull();
      expect(upload.timestamp).toBeDefined();
    });

    it('round-trip: lookup por uploadId devuelve el mismo registro', () => {
      const created = repo.create({
        userId: 'user-456',
        storedFilename: 'def-uuid.png',
        mimeType: 'image/png',
        sizeBytes: 2048,
      });

      const found = repo.findById(created.uploadId);
      expect(found).not.toBeNull();
      expect(found?.uploadId).toBe(created.uploadId);
      expect(found?.userId).toBe('user-456');
      expect(found?.storedFilename).toBe('def-uuid.png');
    });

    it('genera uploadId distinto para cada create (no colisiones)', () => {
      const a = repo.create({
        userId: 'user-abc',
        storedFilename: 'a.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 100,
      });
      const b = repo.create({
        userId: 'user-abc',
        storedFilename: 'b.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 200,
      });
      expect(a.uploadId).not.toBe(b.uploadId);
    });
  });

  describe('createDatabase init idempotente', () => {
    it('llamar createDatabase dos veces sobre :memory: no falla', () => {
      expect(() => {
        const db2 = createDatabase(':memory:');
        createUploadRepository(db2);
        db2.close();
      }).not.toThrow();
    });
  });

  describe('countByUserId y countAll', () => {
    it('countByUserId devuelve 0 si el usuario no tiene uploads', () => {
      expect(repo.countByUserId('user-nobody')).toBe(0);
    });

    it('countAll devuelve el total de uploads', () => {
      repo.create({ userId: 'u1', storedFilename: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: 1 });
      repo.create({ userId: 'u2', storedFilename: 'b.jpg', mimeType: 'image/jpeg', sizeBytes: 2 });
      expect(repo.countAll()).toBe(2);
    });
  });

  describe('findById', () => {
    it('devuelve null para un uploadId que no existe', () => {
      const result = repo.findById('nonexistent-id');
      expect(result).toBeNull();
    });
  });
});
