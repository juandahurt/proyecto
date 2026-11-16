import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

/**
 * Crea e inicializa una conexión SQLite para ingestion-service.
 *
 * Para producción/dev usa process.env.DB_PATH o './data/ingestion.db'.
 * Para tests pasa ':memory:' como dbPath para evitar archivos residuales.
 *
 * El schema de la tabla 'uploads' se crea con IF NOT EXISTS, por lo que
 * llamar a esta función múltiples veces sobre la misma BD es idempotente.
 *
 * @param dbPath - Ruta al archivo SQLite o ':memory:' para BD en RAM.
 * @returns Instancia de Database abierta y con el schema inicializado.
 */
export function createDatabase(dbPath?: string): Database.Database {
  const resolvedPath =
    dbPath ?? process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'ingestion.db');

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
    CREATE TABLE IF NOT EXISTS uploads (
      upload_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      confidence TEXT,
      stored_filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_uploads_user_id ON uploads (user_id);
  `);

  return db;
}
