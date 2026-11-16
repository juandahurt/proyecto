import Database from 'better-sqlite3';

/**
 * Repositorio para la tabla `onboarding_ack`.
 *
 * hasAck  — comprueba si existe un acknowledgment previo para el usuario.
 * recordAck — UPSERT: inserta o actualiza el acknowledged_at.
 */
export interface OnboardingRepository {
  hasAck(userId: string): boolean;
  recordAck(userId: string, timestamp?: string): void;
}

/**
 * Crea una instancia del repositorio de onboarding.
 *
 * @param db - Instancia de better-sqlite3 ya inicializada con el schema.
 */
export function createOnboardingRepository(db: Database.Database): OnboardingRepository {
  const selectStmt = db.prepare<[string], { found: number }>(
    'SELECT 1 AS found FROM onboarding_ack WHERE user_id = ?'
  );

  const upsertStmt = db.prepare<[string, string]>(
    `INSERT INTO onboarding_ack(user_id, acknowledged_at)
     VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET acknowledged_at = excluded.acknowledged_at`
  );

  return {
    hasAck(userId: string): boolean {
      const row = selectStmt.get(userId);
      return row !== undefined;
    },

    recordAck(userId: string, timestamp?: string): void {
      const ts = timestamp ?? new Date().toISOString();
      upsertStmt.run(userId, ts);
    },
  };
}
