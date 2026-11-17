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

  describe('saveCritique / getDetail (u4-T01)', () => {
    const cats = (['CAT-1', 'CAT-2', 'CAT-3', 'CAT-4', 'CAT-5'] as const).map((id, i) => ({
      id,
      name: (
        ['Composition', 'Proportions', 'Line Quality', 'Values (Shading)', 'Perspective'] as const
      )[i],
      score: 50 + i,
      feedback: `fb ${id}`,
    }));
    const readyOutcome = {
      kind: 'ready' as const,
      critique: { confidence: 'MEDIUM' as const, categories: cats },
    };
    const mk = () =>
      repo.create({ userId: 'u', storedFilename: 'f.jpg', mimeType: 'image/jpeg', sizeBytes: 1 });
    const count = (id: string) =>
      (
        db.prepare('SELECT COUNT(*) n FROM category_critiques WHERE upload_id = ?').get(id) as {
          n: number;
        }
      ).n;

    it('saveCritique ready: UPDATE y 5 filas (lectura SQL directa)', () => {
      const up = mk();
      repo.saveCritique(up.uploadId, readyOutcome);
      expect(
        db.prepare('SELECT status, confidence FROM uploads WHERE upload_id = ?').get(up.uploadId)
      ).toEqual({ status: 'ready', confidence: 'MEDIUM' });
      expect(count(up.uploadId)).toBe(5);
    });

    it('saveCritique fallback: solo UPDATE con fallback_reason y 0 filas', () => {
      const up = mk();
      repo.saveCritique(up.uploadId, { kind: 'fallback', reason: 'timeout' });
      expect(
        db
          .prepare('SELECT status, confidence, fallback_reason FROM uploads WHERE upload_id = ?')
          .get(up.uploadId)
      ).toEqual({ status: 'low_confidence', confidence: 'LOW', fallback_reason: 'timeout' });
      expect(count(up.uploadId)).toBe(0);
    });

    it('saveCritique rollback atómico: UNIQUE violado en la 5.ª fila no deja filas ni UPDATE', () => {
      const up = mk();
      const dup = {
        kind: 'ready' as const,
        critique: {
          confidence: 'HIGH' as const,
          categories: [...cats.slice(0, 4), { ...cats[0] }],
        },
      };
      expect(() => repo.saveCritique(up.uploadId, dup)).toThrow(/UNIQUE/);
      expect(count(up.uploadId)).toBe(0);
      expect(
        db.prepare('SELECT status, confidence FROM uploads WHERE upload_id = ?').get(up.uploadId)
      ).toEqual({ status: null, confidence: null });
    });

    it('getDetail devuelve null si el upload no existe', () => {
      expect(repo.getDetail('no-existe')).toBeNull();
    });

    it('getDetail: categorías ordenadas por category_id y timestamp ISO con Z', () => {
      const up = mk();
      repo.saveCritique(up.uploadId, {
        kind: 'ready',
        critique: { confidence: 'HIGH', categories: [...cats].reverse() },
      });
      const d = repo.getDetail(up.uploadId)!;
      expect(d.categories.map((c) => c.categoryId)).toEqual(cats.map((c) => c.id));
      expect(d.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(d.status).toBe('ready');
      expect(d.fallbackReason).toBeNull();
    });

    it('getDetail de un upload sin crítica persistida: status y confidence null', () => {
      const d = repo.getDetail(mk().uploadId)!;
      expect(d.status).toBeNull();
      expect(d.confidence).toBeNull();
      expect(d.categories).toEqual([]);
    });
  });
});
