import Database from 'better-sqlite3';
import crypto from 'crypto';

/**
 * Tipo de usuario tal como se expone fuera del repositorio.
 * No incluye password_hash — el hash nunca sale del módulo de persistencia.
 */
export interface User {
  id: string;
  email: string;
  createdAt: string;
}

/** Fila interna de la BD — solo se usa dentro de este módulo. */
interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface UserRepository {
  create(params: { email: string; passwordHash: string }): User;
  findByEmail(email: string): User | null;
  findByEmailWithHash(email: string): (User & { passwordHash: string }) | null;
}

/**
 * Crea una instancia del repositorio de usuarios.
 *
 * El id del usuario se genera en el servidor con crypto.randomUUID() —
 * nunca viene del request (NEVER accept user-supplied id).
 *
 * @param db - Instancia de better-sqlite3 ya inicializada con el schema.
 */
export function createUserRepository(db: Database.Database): UserRepository {
  const insertStmt = db.prepare<[string, string, string]>(
    'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)'
  );

  const findByEmailStmt = db.prepare<[string], UserRow>(
    'SELECT id, email, password_hash, created_at FROM users WHERE email = ?'
  );

  function rowToUser(row: UserRow): User {
    return {
      id: row.id,
      email: row.email,
      createdAt: row.created_at,
    };
  }

  return {
    create({ email, passwordHash }): User {
      const id = crypto.randomUUID();
      insertStmt.run(id, email, passwordHash);
      const row = findByEmailStmt.get(email)!;
      return rowToUser(row);
    },

    findByEmail(email: string): User | null {
      const row = findByEmailStmt.get(email);
      return row ? rowToUser(row) : null;
    },

    findByEmailWithHash(email: string): (User & { passwordHash: string }) | null {
      const row = findByEmailStmt.get(email);
      if (!row) return null;
      return { ...rowToUser(row), passwordHash: row.password_hash };
    },
  };
}
