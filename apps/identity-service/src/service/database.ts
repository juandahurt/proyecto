import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

/**
 * Crea e inicializa una conexión SQLite para identity-service.
 *
 * Para producción/dev usa process.env.DB_PATH o './data/identity.db'.
 * Para tests pasa ':memory:' como dbPath para evitar archivos residuales.
 *
 * El schema de la tabla 'users' se crea con IF NOT EXISTS, por lo que
 * llamar a esta función múltiples veces sobre la misma BD es idempotente.
 *
 * @param dbPath - Ruta al archivo SQLite o ':memory:' para BD en RAM.
 * @returns Instancia de Database abierta y con el schema inicializado.
 */
export function createDatabase(dbPath?: string): Database.Database {
  const resolvedPath =
    dbPath ?? process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'identity.db');

  if (resolvedPath !== ':memory:') {
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(resolvedPath);

  if (resolvedPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS upload_counters (
      user_id TEXT NOT NULL,
      year_month TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, year_month)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_upload_counters_user_id ON upload_counters(user_id)
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      user_id TEXT NOT NULL PRIMARY KEY,
      tier TEXT NOT NULL DEFAULT 'free',
      upgraded_at TEXT
    )
  `);

  return db;
}
