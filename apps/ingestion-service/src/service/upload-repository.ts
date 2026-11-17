import Database from 'better-sqlite3';
import crypto from 'crypto';
import { CategoryCritique, UploadDetail } from '@proyecto/shared-types';
import { CritiqueOutcome } from './critique-outcome';

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

/** Detalle persistido de un upload (u4-T01). status/confidence null = sin crítica persistida. */
export interface UploadDetailRecord {
  uploadId: string;
  userId: string;
  /** ISO-8601 UTC con sufijo Z. */
  timestamp: string;
  status: UploadDetail['data']['status'] | null;
  confidence: UploadDetail['data']['confidence'] | null;
  fallbackReason: UploadDetail['data']['fallbackReason'] | null;
  categories: CategoryCritique[];
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
  /** Persiste la crítica en una sola transacción. Lanza si algo falla (rollback total). */
  saveCritique(uploadId: string, outcome: CritiqueOutcome): void;
  /** null si el upload no existe. */
  getDetail(uploadId: string): UploadDetailRecord | null;
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

  const updateReadyStmt = db.prepare<[string, string]>(
    "UPDATE uploads SET confidence = ?, status = 'ready' WHERE upload_id = ?"
  );
  const updateFallbackStmt = db.prepare<[string, string]>(
    "UPDATE uploads SET confidence = 'LOW', status = 'low_confidence', fallback_reason = ? WHERE upload_id = ?"
  );
  const insertCritiqueStmt = db.prepare<[string, string, string, string, number, string]>(
    'INSERT INTO category_critiques (critique_id, upload_id, category_id, category_name, score, feedback) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const detailRowStmt = db.prepare<[string]>(
    'SELECT upload_id, user_id, timestamp, status, confidence, fallback_reason FROM uploads WHERE upload_id = ?'
  );
  const categoriesStmt = db.prepare<[string]>(
    'SELECT category_id, category_name, score, feedback FROM category_critiques WHERE upload_id = ? ORDER BY category_id ASC'
  );

  const saveTx = db.transaction((uploadId: string, outcome: CritiqueOutcome) => {
    if (outcome.kind === 'fallback') {
      // D-3: sin críticas que guardar en un fallback.
      updateFallbackStmt.run(outcome.reason, uploadId);
      return;
    }
    updateReadyStmt.run(outcome.critique.confidence, uploadId);
    for (const cat of outcome.critique.categories) {
      insertCritiqueStmt.run(
        crypto.randomUUID(),
        uploadId,
        cat.id,
        cat.name,
        cat.score,
        cat.feedback
      );
    }
  });

  /** SQLite guarda 'YYYY-MM-DD HH:MM:SS' en UTC sin zona; se expone como ISO con Z. */
  function toIsoUtc(sqliteTs: string): string {
    return new Date(`${sqliteTs.replace(' ', 'T')}Z`).toISOString();
  }

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

    saveCritique(uploadId: string, outcome: CritiqueOutcome): void {
      saveTx(uploadId, outcome);
    },

    getDetail(uploadId: string): UploadDetailRecord | null {
      const row = detailRowStmt.get(uploadId) as
        | {
            upload_id: string;
            user_id: string;
            timestamp: string;
            status: UploadDetailRecord['status'];
            confidence: UploadDetailRecord['confidence'];
            fallback_reason: UploadDetailRecord['fallbackReason'];
          }
        | undefined;
      if (!row) return null;
      const cats = categoriesStmt.all(uploadId) as {
        category_id: CategoryCritique['categoryId'];
        category_name: CategoryCritique['categoryName'];
        score: number;
        feedback: string;
      }[];
      return {
        uploadId: row.upload_id,
        userId: row.user_id,
        timestamp: toIsoUtc(row.timestamp),
        status: row.status,
        confidence: row.confidence,
        fallbackReason: row.fallback_reason,
        categories: cats.map((c) => ({
          categoryId: c.category_id,
          categoryName: c.category_name,
          score: c.score,
          feedback: c.feedback,
        })),
      };
    },
  };
}
