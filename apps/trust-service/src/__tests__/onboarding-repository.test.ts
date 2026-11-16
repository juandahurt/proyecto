import Database from 'better-sqlite3';
import { createDatabase } from '../service/database';
import { createOnboardingRepository } from '../service/onboarding-repository';

describe('OnboardingRepository', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  describe('hasAck', () => {
    it('returns false when no ack exists for the user', () => {
      const repo = createOnboardingRepository(db);
      expect(repo.hasAck('user-no-ack')).toBe(false);
    });

    it('returns true after recordAck is called', () => {
      const repo = createOnboardingRepository(db);
      repo.recordAck('user-abc');
      expect(repo.hasAck('user-abc')).toBe(true);
    });

    it('does not bleed ack from one user to another', () => {
      const repo = createOnboardingRepository(db);
      repo.recordAck('user-1');
      expect(repo.hasAck('user-2')).toBe(false);
    });
  });

  describe('recordAck', () => {
    it('writes exactly 1 row after one call', () => {
      const repo = createOnboardingRepository(db);
      repo.recordAck('user-abc');
      const count = db
        .prepare<[string], { n: number }>(
          'SELECT COUNT(*) AS n FROM onboarding_ack WHERE user_id = ?'
        )
        .get('user-abc');
      expect(count?.n).toBe(1);
    });

    it('UPSERT: two calls leave exactly 1 row (idempotent)', () => {
      const repo = createOnboardingRepository(db);
      repo.recordAck('user-abc', '2026-01-01T00:00:00.000Z');
      repo.recordAck('user-abc', '2026-01-02T00:00:00.000Z');
      const count = db
        .prepare<[string], { n: number }>(
          'SELECT COUNT(*) AS n FROM onboarding_ack WHERE user_id = ?'
        )
        .get('user-abc');
      expect(count?.n).toBe(1);
    });

    it('stores a parseable ISO 8601 timestamp when no timestamp provided', () => {
      const repo = createOnboardingRepository(db);
      repo.recordAck('user-ts');
      const row = db
        .prepare<[string], { acknowledged_at: string }>(
          'SELECT acknowledged_at FROM onboarding_ack WHERE user_id = ?'
        )
        .get('user-ts');
      expect(row).toBeDefined();
      const parsed = new Date(row!.acknowledged_at);
      expect(Number.isNaN(parsed.getTime())).toBe(false);
    });

    it('stores a custom timestamp when provided', () => {
      const repo = createOnboardingRepository(db);
      const ts = '2026-11-15T12:00:00.000Z';
      repo.recordAck('user-custom', ts);
      const row = db
        .prepare<[string], { acknowledged_at: string }>(
          'SELECT acknowledged_at FROM onboarding_ack WHERE user_id = ?'
        )
        .get('user-custom');
      expect(row?.acknowledged_at).toBe(ts);
    });
  });
});
