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
