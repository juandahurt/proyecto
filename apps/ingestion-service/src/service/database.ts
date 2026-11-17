import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

/**
 * Crea e inicializa una conexión SQLite para ingestion-service.
 *
 * Para producción/dev usa process.env.DB_PATH o './data/ingestion.db'.
 * Para tests pasa ':memory:' como dbPath para evitar archivos residuales.
 *
 * El schema ('uploads' y 'category_critiques') se crea con IF NOT EXISTS y las
 * columnas nuevas de 'uploads' se añaden solo si faltan (PRAGMA table_info), por lo
 * que llamar a esta función múltiples veces sobre la misma BD es idempotente.
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

  // Las FK de SQLite están desactivadas por defecto: se activan en cada conexión.
  db.pragma('foreign_keys = ON');

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

  // Migración idempotente (u4-T01): una BD creada con el schema anterior no tiene
  // las columnas nuevas; CREATE TABLE IF NOT EXISTS no las añade. Solo ADD COLUMN
  // si faltan, conservando las filas existentes.
  const existingCols = new Set(
    (db.prepare('PRAGMA table_info(uploads)').all() as { name: string }[]).map((c) => c.name)
  );
  if (!existingCols.has('status')) {
    db.exec(
      "ALTER TABLE uploads ADD COLUMN status TEXT CHECK (status IN ('ready','low_confidence'))"
    );
  }
  if (!existingCols.has('fallback_reason')) {
    db.exec('ALTER TABLE uploads ADD COLUMN fallback_reason TEXT');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS category_critiques (
      critique_id TEXT PRIMARY KEY,
      upload_id TEXT NOT NULL REFERENCES uploads (upload_id),
      category_id TEXT NOT NULL CHECK (category_id IN ('CAT-1','CAT-2','CAT-3','CAT-4','CAT-5')),
      category_name TEXT NOT NULL,
      score INTEGER CHECK (score BETWEEN 0 AND 100),
      feedback TEXT NOT NULL,
      UNIQUE (upload_id, category_id)
    );

    CREATE INDEX IF NOT EXISTS idx_category_critiques_upload_id ON category_critiques (upload_id);
  `);

  return db;
}
