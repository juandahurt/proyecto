import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
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
  describe('listByUser (u5-T01)', () => {
    const CATS = (['CAT-1', 'CAT-2', 'CAT-3', 'CAT-4', 'CAT-5'] as const).map((id, i) => ({
      id,
      name: (
        ['Composition', 'Proportions', 'Line Quality', 'Values (Shading)', 'Perspective'] as const
      )[i],
      score: 10 + i,
      feedback: `fb ${id}`,
    }));
    const ready = {
      kind: 'ready' as const,
      critique: { confidence: 'HIGH' as const, categories: [...CATS].reverse() },
    };
    const mkFor = (userId: string, outcome?: Parameters<typeof repo.saveCritique>[1]) => {
      const up = repo.create({
        userId,
        storedFilename: 'f.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1,
      });
      if (outcome) repo.saveCritique(up.uploadId, outcome);
      return up.uploadId;
    };
    const setTs = (id: string, ts: string) =>
      db.prepare('UPDATE uploads SET timestamp = ? WHERE upload_id = ?').run(ts, id);

    it('listByUser vacío: sin uploads devuelve []', () => {
      expect(repo.listByUser('nadie')).toEqual([]);
    });

    it('listByUser: orden con timestamps distintos, más reciente primero', () => {
      const a = mkFor('u1', ready);
      const b = mkFor('u1', ready);
      const c = mkFor('u1', ready);
      setTs(a, '2026-01-01 10:00:00');
      setTs(b, '2026-01-03 10:00:00');
      setTs(c, '2026-01-02 10:00:00');
      expect(repo.listByUser('u1').map((x) => x.uploadId)).toEqual([b, c, a]);
    });

    it('listByUser: desempate por rowid DESC con timestamps idénticos (mismo segundo)', () => {
      const ids = [mkFor('u1', ready), mkFor('u1', ready), mkFor('u1', ready), mkFor('u1', ready)];
      for (const id of ids) setTs(id, '2026-02-02 12:00:00');
      expect(repo.listByUser('u1').map((x) => x.uploadId)).toEqual([...ids].reverse());
    });

    it('listByUser: no incluye uploads de otro usuario', () => {
      const mine = mkFor('u1', ready);
      mkFor('u2', ready);
      mkFor('u2', ready);
      const list = repo.listByUser('u1');
      expect(list.map((x) => x.uploadId)).toEqual([mine]);
      expect(repo.listByUser('u2')).toHaveLength(2);
    });

    it('listByUser: sin crítica persistida (status nulo) no aparece', () => {
      const withCritique = mkFor('u1', ready);
      mkFor('u1');
      expect(repo.listByUser('u1').map((x) => x.uploadId)).toEqual([withCritique]);
    });

    it('listByUser ready: 5 scores por category_id ASC, timestamp ISO con Z y sin fallbackReason', () => {
      const id = mkFor('u1', ready);
      setTs(id, '2026-03-04 05:06:07');
      const [item] = repo.listByUser('u1');
      expect(item).toEqual({
        uploadId: id,
        timestamp: '2026-03-04T05:06:07.000Z',
        status: 'ready',
        confidence: 'HIGH',
        fallbackReason: null,
        scores: CATS.map((c) => ({ categoryId: c.id, score: c.score })),
      });
    });

    it('listByUser low_confidence: scores [] y fallbackReason', () => {
      const id = mkFor('u1', { kind: 'fallback', reason: 'timeout' });
      const [item] = repo.listByUser('u1');
      expect(item).toMatchObject({
        uploadId: id,
        status: 'low_confidence',
        confidence: 'LOW',
        fallbackReason: 'timeout',
        scores: [],
      });
    });

    it('listByUser: exactamente 2 consultas (sin N+1) dentro de una transacción con 50 uploads', () => {
      const local = createDatabase(':memory:');
      const calls: boolean[] = [];
      const realPrepare = local.prepare.bind(local);
      jest.spyOn(local, 'prepare').mockImplementation(((sql: string) => {
        const stmt = realPrepare(sql);
        const realAll = stmt.all.bind(stmt);
        jest.spyOn(stmt, 'all').mockImplementation(((...args: unknown[]) => {
          calls.push(local.inTransaction);
          return (realAll as (...a: unknown[]) => unknown)(...args);
        }) as typeof stmt.all);
        return stmt;
      }) as typeof local.prepare);
      const r = createUploadRepository(local);
      for (let i = 0; i < 50; i++) {
        const up = r.create({
          userId: 'u1',
          storedFilename: 'f.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 1,
        });
        r.saveCritique(up.uploadId, ready);
      }
      calls.length = 0;
      expect(r.listByUser('u1')).toHaveLength(50);
      expect(calls).toEqual([true, true]);
      local.close();
    });
  });
  describe('timestamp con milisegundos (u5-T03)', () => {
    const mk = (userId = 'u1') =>
      repo.create({ userId, storedFilename: 'f.jpg', mimeType: 'image/jpeg', sizeBytes: 1 });
    const ready = {
      kind: 'ready' as const,
      critique: {
        confidence: 'HIGH' as const,
        categories: (['CAT-1', 'CAT-2', 'CAT-3', 'CAT-4', 'CAT-5'] as const).map((id) => ({
          id,
          name: (
            {
              'CAT-1': 'Composition',
              'CAT-2': 'Proportions',
              'CAT-3': 'Line Quality',
              'CAT-4': 'Values (Shading)',
              'CAT-5': 'Perspective',
            } as const
          )[id],
          score: 50,
          feedback: 'fb',
        })),
      },
    };
    const rawTs = (id: string) =>
      (
        db.prepare('SELECT timestamp FROM uploads WHERE upload_id = ?').get(id) as {
          timestamp: string;
        }
      ).timestamp;
    /** Inserta una fila con timestamp crudo (SQL directo) y crítica persistida. */
    const insertRaw = (id: string, ts: string) => {
      db.prepare(
        "INSERT INTO uploads (upload_id, user_id, timestamp, stored_filename, mime_type, size_bytes) VALUES (?, 'u1', ?, 'f.jpg', 'image/jpeg', 1)"
      ).run(id, ts);
      repo.saveCritique(id, ready);
    };

    it('create guarda milisegundos explícitos (ISO UTC con Z) en el timestamp crudo', () => {
      const up = mk();
      expect(rawTs(up.uploadId)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('getDetailHeader y listByUser devuelven ISO con Z y milisegundos para una fila nueva', () => {
      const up = mk();
      repo.saveCritique(up.uploadId, ready);
      const raw = rawTs(up.uploadId);
      expect(repo.getDetailHeader(up.uploadId)!.timestamp).toBe(raw);
      expect(repo.listByUser('u1')[0].timestamp).toBe(raw);
    });

    it('toIsoUtc entiende ambos formatos: una fila vieja sin migrar produce ISO con .000Z', () => {
      insertRaw('11111111-1111-4111-8111-111111111111', '2026-11-18 02:33:19');
      expect(repo.getDetailHeader('11111111-1111-4111-8111-111111111111')!.timestamp).toBe(
        '2026-11-18T02:33:19.000Z'
      );
      expect(repo.listByUser('u1')[0].timestamp).toBe('2026-11-18T02:33:19.000Z');
    });

    it('un valor basura no devuelve Invalid Date: lanza un Error definido, no RangeError', () => {
      insertRaw('22222222-2222-4222-8222-222222222222', 'no-es-una-fecha');
      let caught: unknown;
      try {
        repo.getDetailHeader('22222222-2222-4222-8222-222222222222');
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(Error);
      expect(caught).not.toBeInstanceOf(RangeError);
      expect((caught as Error).message).toMatch(/timestamp/i);
      expect(() => repo.listByUser('u1')).toThrow(/timestamp/i);
    });

    it('mismo día mezclado: viejo 23:00:00 y nuevos 10:00:00.500 y 23:00:00.250 (tras migrar)', () => {
      const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ingestion-mix-')), 'm.db');
      const raw = new Database(dbPath);
      raw.exec(
        'CREATE TABLE uploads (upload_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, confidence TEXT, stored_filename TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL);' +
          "INSERT INTO uploads (upload_id,user_id,timestamp,stored_filename,mime_type,size_bytes) VALUES ('old2300','u1','2026-11-18 23:00:00','f','m',1);" +
          "INSERT INTO uploads (upload_id,user_id,timestamp,stored_filename,mime_type,size_bytes) VALUES ('new1000','u1','2026-11-18T10:00:00.500Z','f','m',1);" +
          "INSERT INTO uploads (upload_id,user_id,timestamp,stored_filename,mime_type,size_bytes) VALUES ('new2300','u1','2026-11-18T23:00:00.250Z','f','m',1);"
      );
      raw.close();
      const mdb = createDatabase(dbPath);
      const mrepo = createUploadRepository(mdb);
      for (const id of ['old2300', 'new1000', 'new2300']) mrepo.saveCritique(id, ready);
      expect(mrepo.listByUser('u1').map((x) => x.uploadId)).toEqual([
        'new2300',
        'old2300',
        'new1000',
      ]);
      mdb.close();
      fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
    });

    it('dos filas con el mismo milisegundo conservan el desempate por rowid DESC', () => {
      const ids = ['a', 'b', 'c'].map((_, i) => `0000000${i}-0000-4000-8000-000000000000`);
      for (const id of ids) insertRaw(id, '2026-11-18T12:00:00.123Z');
      expect(repo.listByUser('u1').map((x) => x.uploadId)).toEqual([...ids].reverse());
    });

    it('uploads consecutivos: timestamps crecientes (o iguales) y el listado respeta la inserción', () => {
      const a = mk();
      repo.saveCritique(a.uploadId, ready);
      const b = mk();
      repo.saveCritique(b.uploadId, ready);
      expect(rawTs(b.uploadId) >= rawTs(a.uploadId)).toBe(true);
      expect(repo.listByUser('u1').map((x) => x.uploadId)).toEqual([b.uploadId, a.uploadId]);
    });
  });
});
