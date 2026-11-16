import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

/**
 * Crea e inicializa una conexión SQLite para trust-service.
 *
 * Para producción/dev usa process.env.DB_PATH o './data/trust.db'.
 * Para tests pasa ':memory:' como dbPath para evitar archivos residuales.
 *
 * El schema de la tabla 'onboarding_ack' se crea con IF NOT EXISTS, por lo
 * que llamar a esta función múltiples veces sobre la misma BD es idempotente.
 *
 * @param dbPath - Ruta al archivo SQLite o ':memory:' para BD en RAM.
 * @returns Instancia de Database abierta y con el schema inicializado.
 */
export function createDatabase(dbPath?: string): Database.Database {
  const resolvedPath =
    dbPath ?? process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'trust.db');

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
    CREATE TABLE IF NOT EXISTS onboarding_ack (
      user_id TEXT PRIMARY KEY,
      acknowledged_at TEXT NOT NULL
    )
  `);

  return db;
}
