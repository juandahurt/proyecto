import Database from 'better-sqlite3';
import crypto from 'crypto';
import { CategoryCritique, UploadDetail, UploadListItem } from '@proyecto/shared-types';
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

/** Resumen de un upload para el listado (u5-T01). Solo uploads con crítica persistida. */
export interface UploadListRecord {
  uploadId: string;
  /** ISO-8601 UTC con sufijo Z. */
  timestamp: string;
  status: UploadListItem['status'];
  confidence: UploadListItem['confidence'];
  fallbackReason: UploadListItem['fallbackReason'] | null;
  scores: { categoryId: CategoryCritique['categoryId']; score: number }[];
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
  /** null si el upload no existe. Incluye las categorías (lectura completa). */
  getDetail(uploadId: string): UploadDetailRecord | null;
  /** Solo la fila del upload (dueño, estado, timestamp), SIN leer category_critiques. null si no existe. */
  getDetailHeader(uploadId: string): Omit<UploadDetailRecord, 'categories'> | null;
  /** Categorías de un upload ordenadas por category_id ASC. Llamar solo tras comprobar el dueño. */
  getCategories(uploadId: string): CategoryCritique[];
  /** Uploads del usuario con crítica persistida, más reciente primero (u5-T01). */
  listByUser(userId: string): UploadListRecord[];
  /**
   * Borra todas las filas de category_critiques y uploads de un usuario en una
   * sola transacción (u13-T01). Devuelve los storedFilename de los uploads
   * borrados para que el llamador limpie los blobs fuera de la transacción.
   * Idempotente: usuario sin uploads devuelve un array vacío.
   */
  deleteByUserId(userId: string): string[];
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
    "INSERT INTO uploads (upload_id, user_id, timestamp, stored_filename, mime_type, size_bytes) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?, ?, ?)"
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

  // u5-T01: listado sin N+1. Consulta 1: cabeceras del usuario con crítica persistida.
  // Consulta 2: scores de todos esos uploads (JOIN con uploads filtrado por user_id).
  const listHeadersStmt = db.prepare<[string]>(
    'SELECT upload_id, timestamp, status, confidence, fallback_reason FROM uploads WHERE user_id = ? AND status IS NOT NULL ORDER BY timestamp DESC, rowid DESC'
  );
  const listScoresStmt = db.prepare<[string]>(
    'SELECT c.upload_id, c.category_id, c.score FROM category_critiques c JOIN uploads u ON u.upload_id = c.upload_id WHERE u.user_id = ? AND u.status IS NOT NULL ORDER BY c.upload_id, c.category_id ASC'
  );
  // Una sola transacción: ambas lecturas ven el mismo estado consistente.
  const listTx = db.transaction((userId: string): UploadListRecord[] => {
    const headers = listHeadersStmt.all(userId) as {
      upload_id: string;
      timestamp: string;
      status: UploadListRecord['status'];
      confidence: UploadListRecord['confidence'];
      fallback_reason: UploadListRecord['fallbackReason'];
    }[];
    const scoreRows = listScoresStmt.all(userId) as {
      upload_id: string;
      category_id: UploadListRecord['scores'][number]['categoryId'];
      score: number;
    }[];
    const byUpload = new Map<string, UploadListRecord['scores']>();
    for (const r of scoreRows) {
      const arr = byUpload.get(r.upload_id) ?? [];
      arr.push({ categoryId: r.category_id, score: r.score });
      byUpload.set(r.upload_id, arr);
    }
    return headers.map((h) => ({
      uploadId: h.upload_id,
      timestamp: toIsoUtc(h.timestamp),
      status: h.status,
      confidence: h.confidence,
      fallbackReason: h.fallback_reason,
      scores: byUpload.get(h.upload_id) ?? [],
    }));
  });

  const selectUploadIdsAndFilesStmt = db.prepare<[string]>(
    'SELECT upload_id, stored_filename FROM uploads WHERE user_id = ?'
  );
  const deleteCritiquesByUserStmt = db.prepare<[string]>(
    'DELETE FROM category_critiques WHERE upload_id IN (SELECT upload_id FROM uploads WHERE user_id = ?)'
  );
  const deleteUploadsByUserStmt = db.prepare<[string]>('DELETE FROM uploads WHERE user_id = ?');

  // Orden explícito (sin ON DELETE CASCADE en el schema): category_critiques primero,
  // uploads después, ambas dentro de la misma transacción.
  const deleteByUserTx = db.transaction((userId: string): string[] => {
    const rows = selectUploadIdsAndFilesStmt.all(userId) as {
      upload_id: string;
      stored_filename: string;
    }[];
    deleteCritiquesByUserStmt.run(userId);
    deleteUploadsByUserStmt.run(userId);
    return rows.map((r) => r.stored_filename);
  });

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

  /**
   * Acepta el formato nuevo ('YYYY-MM-DDTHH:MM:SS.mmmZ', ms preservados) y el viejo de
   * SQLite ('YYYY-MM-DD HH:MM:SS', UTC sin zona; se expone con '.000Z'). Cualquier otro
   * valor lanza un Error definido (nunca RangeError ni 'Invalid Date').
   */
  function toIsoUtc(stored: string): string {
    const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d{3}))?Z?$/.exec(stored);
    const date = m ? new Date(`${m[1]}T${m[2]}.${m[3] ?? '000'}Z`) : null;
    if (!date || Number.isNaN(date.getTime())) {
      throw new Error('invalid stored timestamp format');
    }
    return date.toISOString();
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

  const repo: UploadRepository = {
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

    getDetailHeader(uploadId: string): Omit<UploadDetailRecord, 'categories'> | null {
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
      return {
        uploadId: row.upload_id,
        userId: row.user_id,
        timestamp: toIsoUtc(row.timestamp),
        status: row.status,
        confidence: row.confidence,
        fallbackReason: row.fallback_reason,
      };
    },

    getCategories(uploadId: string): CategoryCritique[] {
      const cats = categoriesStmt.all(uploadId) as {
        category_id: CategoryCritique['categoryId'];
        category_name: CategoryCritique['categoryName'];
        score: number;
        feedback: string;
      }[];
      return cats.map((c) => ({
        categoryId: c.category_id,
        categoryName: c.category_name,
        score: c.score,
        feedback: c.feedback,
      }));
    },

    listByUser(userId: string): UploadListRecord[] {
      return listTx(userId);
    },

    deleteByUserId(userId: string): string[] {
      return deleteByUserTx(userId);
    },

    getDetail(uploadId: string): UploadDetailRecord | null {
      const header = repo.getDetailHeader(uploadId);
      if (!header) return null;
      return { ...header, categories: repo.getCategories(uploadId) };
    },
  };
  return repo;
}
