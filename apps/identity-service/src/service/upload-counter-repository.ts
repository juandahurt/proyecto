import Database from 'better-sqlite3';

export interface UploadCounterRepository {
  getForMonth(userId: string, yearMonth: string): number;
  incrementForMonth(userId: string, yearMonth: string): number;
  /** Pone a 0 el contador de ese usuario+mes. Idempotente si no existía la fila. */
  resetForMonth(userId: string, yearMonth: string): void;
}

interface CounterRow {
  count: number;
}

export function createUploadCounterRepository(db: Database.Database): UploadCounterRepository {
  const selectStmt = db.prepare<[string, string], CounterRow>(
    'SELECT count FROM upload_counters WHERE user_id = ? AND year_month = ?'
  );

  const upsertStmt = db.prepare<[string, string], CounterRow>(
    'INSERT INTO upload_counters (user_id, year_month, count) VALUES (?, ?, 1) ON CONFLICT(user_id, year_month) DO UPDATE SET count = count + 1 RETURNING count'
  );

  const resetStmt = db.prepare<[string, string]>(
    'INSERT INTO upload_counters (user_id, year_month, count) VALUES (?, ?, 0) ON CONFLICT(user_id, year_month) DO UPDATE SET count = 0'
  );

  return {
    getForMonth(userId: string, yearMonth: string): number {
      const row = selectStmt.get(userId, yearMonth);
      return row?.count ?? 0;
    },

    incrementForMonth(userId: string, yearMonth: string): number {
      const row = upsertStmt.get(userId, yearMonth);
      if (row === undefined) {
        throw new Error(
          'UPSERT RETURNING failed — SQLite version may not support RETURNING clause'
        );
      }
      return row.count;
    },

    resetForMonth(userId: string, yearMonth: string): void {
      resetStmt.run(userId, yearMonth);
    },
  };
}
