import Database from 'better-sqlite3';
import { CritiqueResponse, PersistedCritique } from '@proyecto/shared-types';

/**
 * Repositorio de criticas persistidas en SQLite.
 *
 * No usa ORM ni abstracciones de mapper: SQL directo con better-sqlite3.
 * La columna response_json almacena JSON.stringify(response); el repositorio
 * hace JSON.parse al leer. Simple, sin magia.
 */
export class CritiqueRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Persiste una critica y devuelve el id autoincremental asignado por SQLite.
   *
   * @param input - Texto de entrada original del request.
   * @param response - Respuesta de Anthropic validada (CritiqueResponse).
   * @returns Objeto con el id asignado.
   */
  save(input: string, response: CritiqueResponse): { id: number } {
    const stmt = this.db.prepare('INSERT INTO critiques (input, response_json) VALUES (?, ?)');
    const result = stmt.run(input, JSON.stringify(response));
    return { id: result.lastInsertRowid as number };
  }

  /**
   * Lee un registro de critica por su id.
   *
   * @param id - Id autoincremental del registro.
   * @returns El registro deserializado, o null si no existe.
   */
  getById(id: number): PersistedCritique | null {
    const stmt = this.db.prepare(
      'SELECT id, input, response_json, created_at FROM critiques WHERE id = ?'
    );
    const row = stmt.get(id) as
      { id: number; input: string; response_json: string; created_at: string } | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      input: row.input,
      response: JSON.parse(row.response_json) as CritiqueResponse,
      createdAt: row.created_at,
    };
  }
}
