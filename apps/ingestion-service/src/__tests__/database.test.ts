import Database from 'better-sqlite3';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { createDatabase } from '../service/database';

describe('createDatabase', () => {
  describe('con :memory:', () => {
    it('crea la tabla uploads idempotentemente', () => {
      const db = createDatabase(':memory:');
      // Verificar que la tabla existe
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='uploads'")
        .all();
      expect(tables).toHaveLength(1);
      db.close();
    });

    it('crear la misma BD en memory dos veces no falla (idempotencia)', () => {
      expect(() => {
        const db1 = createDatabase(':memory:');
        db1.close();
        const db2 = createDatabase(':memory:');
        db2.close();
      }).not.toThrow();
    });
  });

  describe('con ruta de archivo real', () => {
    let tmpDir: string;
    let dbPath: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingestion-db-test-'));
      dbPath = path.join(tmpDir, 'test.db');
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('crea el archivo de BD y la tabla uploads', () => {
      const db = createDatabase(dbPath);
      expect(fs.existsSync(dbPath)).toBe(true);
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='uploads'")
        .all();
      expect(tables).toHaveLength(1);
      db.close();
    });

    it('crea el directorio padre si no existe', () => {
      const nestedPath = path.join(tmpDir, 'nested', 'dir', 'db.sqlite');
      expect(fs.existsSync(path.dirname(nestedPath))).toBe(false);
      const db = createDatabase(nestedPath);
      expect(fs.existsSync(nestedPath)).toBe(true);
      db.close();
    });

    it('es idempotente: abrir dos veces el mismo archivo no falla', () => {
      const db1 = createDatabase(dbPath);
      db1.close();
      expect(() => {
        const db2 = createDatabase(dbPath);
        db2.close();
      }).not.toThrow();
    });

    it('usa DB_PATH del entorno si no se pasa argumento', () => {
      const originalDbPath = process.env.DB_PATH;
      process.env.DB_PATH = dbPath;

      try {
        const db = createDatabase();
        expect(fs.existsSync(dbPath)).toBe(true);
        db.close();
      } finally {
        if (originalDbPath === undefined) {
          delete process.env.DB_PATH;
        } else {
          process.env.DB_PATH = originalDbPath;
        }
      }
    });
  });
});

describe('createDatabase u4: category_critiques y migración', () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingestion-db-u4-'));
    dbPath = path.join(tmpDir, 'old.db');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const cols = (db: ReturnType<typeof createDatabase>, table: string) =>
    (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);

  it('crea category_critiques y las columnas nuevas de uploads', () => {
    const db = createDatabase(':memory:');
    expect(cols(db, 'category_critiques')).toEqual([
      'critique_id',
      'upload_id',
      'category_id',
      'category_name',
      'score',
      'feedback',
    ]);
    expect(cols(db, 'uploads')).toEqual(expect.arrayContaining(['status', 'fallback_reason']));
    db.close();
  });

  it('llamar createDatabase dos veces sobre el mismo archivo es idempotente', () => {
    createDatabase(dbPath).close();
    const db = createDatabase(dbPath);
    expect(cols(db, 'uploads').filter((c) => c === 'status')).toHaveLength(1);
    db.close();
  });

  it('upgrade desde schema viejo: conserva la fila y añade columnas', () => {
    const old = new Database(dbPath);
    old.exec(`
      CREATE TABLE uploads (
        upload_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        confidence TEXT,
        stored_filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL
      );
      INSERT INTO uploads (upload_id, user_id, stored_filename, mime_type, size_bytes)
        VALUES ('old-1', 'u1', 'f.jpg', 'image/jpeg', 5);
    `);
    old.close();
    const db = createDatabase(dbPath);
    const row = db.prepare('SELECT * FROM uploads WHERE upload_id = ?').get('old-1') as Record<
      string,
      unknown
    >;
    expect(row).toMatchObject({ user_id: 'u1', status: null, fallback_reason: null });
    db.close();
  });

  it('FK activa: crítica con upload_id inexistente falla', () => {
    const db = createDatabase(':memory:');
    expect(() =>
      db
        .prepare(
          "INSERT INTO category_critiques VALUES ('c1','no-existe','CAT-1','Composition',50,'x')"
        )
        .run()
    ).toThrow(/FOREIGN KEY/);
    db.close();
  });

  it('CHECK rechaza category_id CAT-9 y score 101', () => {
    const db = createDatabase(':memory:');
    db.prepare(
      "INSERT INTO uploads (upload_id,user_id,stored_filename,mime_type,size_bytes) VALUES ('u','x','f','m',1)"
    ).run();
    const ins = db.prepare("INSERT INTO category_critiques VALUES (?, 'u', ?, 'n', ?, 'f')");
    expect(() => ins.run('c1', 'CAT-9', 50)).toThrow(/CHECK/);
    expect(() => ins.run('c2', 'CAT-1', 101)).toThrow(/CHECK/);
    expect(() => ins.run('c3', 'CAT-1', null)).not.toThrow();
    db.close();
  });
});
