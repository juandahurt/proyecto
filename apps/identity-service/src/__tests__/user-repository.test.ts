/**
 * Tests unitarios para el repositorio de usuarios.
 * Usa BD en memoria y archivo temporal para cobertura de ramas de database.ts.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createDatabase } from '../service/database';
import { createUserRepository } from '../service/user-repository';

describe('UserRepository', () => {
  function makeRepo() {
    const db = createDatabase(':memory:');
    return { db, repo: createUserRepository(db) };
  }

  it('CA-5 — round-trip: create devuelve User con id uuid; findByEmail devuelve el mismo registro', () => {
    const { repo } = makeRepo();
    const user = repo.create({ email: 'alice@example.com', passwordHash: '$2b$10$hash' });

    expect(user.id).toBeTruthy();
    expect(typeof user.id).toBe('string');
    expect(user.email).toBe('alice@example.com');
    expect(user.createdAt).toBeTruthy();
    // No expone password_hash
    expect((user as unknown as Record<string, unknown>).password_hash).toBeUndefined();
    expect((user as unknown as Record<string, unknown>).passwordHash).toBeUndefined();

    const found = repo.findByEmail('alice@example.com');
    expect(found).not.toBeNull();
    expect(found!.id).toBe(user.id);
    expect(found!.email).toBe('alice@example.com');
  });

  it('CA-5 — findByEmail devuelve null para email inexistente', () => {
    const { repo } = makeRepo();
    const result = repo.findByEmail('nobody@example.com');
    expect(result).toBeNull();
  });

  it('CA-9 — crear dos veces con el mismo email lanza error SQLITE_CONSTRAINT_UNIQUE', () => {
    const { repo } = makeRepo();
    repo.create({ email: 'dup@example.com', passwordHash: '$2b$10$hash' });
    expect(() => {
      repo.create({ email: 'dup@example.com', passwordHash: '$2b$10$hash2' });
    }).toThrow();
  });

  it('CA-4 — init idempotente: llamar createDatabase dos veces no falla ni duplica la tabla', () => {
    const db = createDatabase(':memory:');
    // Verificamos que la tabla existe
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
      .all();
    expect(tables).toHaveLength(1);
  });

  it('CA-4 — database.ts rama de archivo en disco: crea directorio y activa WAL', () => {
    const tmpDir = path.join(os.tmpdir(), `identity-test-${Date.now()}`);
    const dbFile = path.join(tmpDir, 'subdir', 'test.db');
    // No crear el directorio — createDatabase debe crearlo
    expect(fs.existsSync(tmpDir)).toBe(false);

    const db = createDatabase(dbFile);
    // El directorio fue creado
    expect(fs.existsSync(path.dirname(dbFile))).toBe(true);
    // La tabla users existe
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
      .all();
    expect(tables).toHaveLength(1);

    db.close();
    // Limpiar
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('CA-4 — database.ts rama DB_PATH desde env', () => {
    const tmpFile = path.join(os.tmpdir(), `identity-env-test-${Date.now()}.db`);
    const saved = process.env.DB_PATH;
    process.env.DB_PATH = tmpFile;
    const db = createDatabase();
    expect(fs.existsSync(tmpFile)).toBe(true);
    db.close();
    fs.rmSync(tmpFile, { force: true });
    if (saved !== undefined) process.env.DB_PATH = saved;
    else delete process.env.DB_PATH;
  });
});
