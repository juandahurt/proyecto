import Database from 'better-sqlite3';
import crypto from 'crypto';

/**
 * Tipo de upload tal como se expone fuera del repositorio.
 * El campo confidence es nullable — u2-T01 lo seteará más tarde.
 */
export interface Upload {
  uploadId: string;
  userId: string;
  timestamp: string;
  storedFilename: string;
  mimeType: string;
  sizeBytes: number;
  confidence: string | null;
}

/** Fila interna de la BD — solo se usa dentro de este módulo. */
interface UploadRow {
  upload_id: string;
  user_id: string;
  timestamp: string;
  stored_filename: string;
  mime_type: string;
  size_bytes: number;
  confidence: string | null;
}

export interface UploadRepository {
  create(params: {
    userId: string;
    storedFilename: string;
    mimeType: string;
    sizeBytes: number;
  }): Upload;
  findById(uploadId: string): Upload | null;
  countByUserId(userId: string): number;
  countAll(): number;
}

/**
 * Crea una instancia del repositorio de uploads.
 *
 * El uploadId se genera en el servidor con crypto.randomUUID() —
 * nunca viene del request.
 *
 * @param db - Instancia de better-sqlite3 ya inicializada con el schema.
 */
export function createUploadRepository(db: Database.Database): UploadRepository {
  const insertStmt = db.prepare<[string, string, string, string, number]>(
    'INSERT INTO uploads (upload_id, user_id, stored_filename, mime_type, size_bytes) VALUES (?, ?, ?, ?, ?)'
  );

  const findByIdStmt = db.prepare<[string]>('SELECT * FROM uploads WHERE upload_id = ?');

  const countByUserIdStmt = db.prepare<[string]>(
    'SELECT COUNT(*) AS n FROM uploads WHERE user_id = ?'
  );

  const countAllStmt = db.prepare('SELECT COUNT(*) AS n FROM uploads');

  function rowToUpload(row: UploadRow): Upload {
    return {
      uploadId: row.upload_id,
      userId: row.user_id,
      timestamp: row.timestamp,
      storedFilename: row.stored_filename,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      confidence: row.confidence,
    };
  }

  return {
    create({ userId, storedFilename, mimeType, sizeBytes }) {
      // ID generado server-side — NUNCA viene del request.
      const uploadId = crypto.randomUUID();
      insertStmt.run(uploadId, userId, storedFilename, mimeType, sizeBytes);
      const row = findByIdStmt.get(uploadId) as UploadRow;
      return rowToUpload(row);
    },

    findById(uploadId: string): Upload | null {
      const row = findByIdStmt.get(uploadId) as UploadRow | undefined;
      return row ? rowToUpload(row) : null;
    },

    countByUserId(userId: string): number {
      const result = countByUserIdStmt.get(userId) as { n: number };
      return result.n;
    },

    countAll(): number {
      const result = countAllStmt.get() as { n: number };
      return result.n;
    },
  };
}
