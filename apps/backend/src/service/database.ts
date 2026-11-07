import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

/**
 * Crea e inicializa una conexion SQLite.
 *
 * Para produccion/dev, usa process.env.DB_PATH o './data/critiques.db'.
 * Para tests, pasa ':memory:' como dbPath para evitar archivos residuales.
 *
 * El schema de la tabla 'critiques' se crea con IF NOT EXISTS, por lo que
 * llamar a esta funcion multiples veces sobre la misma BD es idempotente.
 *
 * @param dbPath - Ruta al archivo SQLite o ':memory:' para BD en RAM.
 * @returns Instancia de Database abierta y con el schema inicializado.
 */
export function createDatabase(dbPath?: string): Database.Database {
  const resolvedPath =
    dbPath ?? process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'critiques.db');

  // Si no es BD en memoria y el directorio no existe, lo creamos.
  if (resolvedPath !== ':memory:') {
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(resolvedPath);

  // WAL mode mejora la concurrencia de lectura. Para BD en memoria es no-op.
  if (resolvedPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }

  // Schema — un CREATE TABLE IF NOT EXISTS es suficiente para el skeleton.
  // No se usan migraciones versionadas (fuera de alcance de WS-T04).
  db.exec(`
    CREATE TABLE IF NOT EXISTS critiques (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      input TEXT NOT NULL,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return db;
}
