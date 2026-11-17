import Database from 'better-sqlite3';
import { createDatabase } from '../service/database';
import {
  createSubscriptionRepository,
  SubscriptionRepository,
} from '../service/subscription-repository';

describe('SubscriptionRepository', () => {
  let db: Database.Database;
  let repo: SubscriptionRepository;

  beforeEach(() => {
    db = createDatabase(':memory:');
    repo = createSubscriptionRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('getTier', () => {
    it('devuelve "free" cuando no hay fila para el usuario', () => {
      expect(repo.getTier('user-no-existe')).toBe('free');
    });

    it('devuelve "free" para un usuario distinto aunque otro sea paid', () => {
      repo.upgradeToPaid('user-a');
      expect(repo.getTier('user-b')).toBe('free');
    });
  });

  describe('upgradeToPaid', () => {
    it('inserta fila con tier="paid" y getTier devuelve "paid"', () => {
      repo.upgradeToPaid('user-paid');
      expect(repo.getTier('user-paid')).toBe('paid');
    });

    it('upgradeToPaid acepta now opcional y registra upgraded_at', () => {
      const now = new Date('2026-01-15T10:00:00.000Z');
      repo.upgradeToPaid('user-ts', now);
      const row = db
        .prepare('SELECT tier, upgraded_at FROM subscriptions WHERE user_id = ?')
        .get('user-ts') as { tier: string; upgraded_at: string };
      expect(row.tier).toBe('paid');
      expect(row.upgraded_at).toBe('2026-01-15T10:00:00.000Z');
    });

    it('upgradeToPaid es idempotente: segunda llamada no falla y tier sigue "paid"', () => {
      repo.upgradeToPaid('user-idem');
      repo.upgradeToPaid('user-idem'); // segunda llamada — no debe lanzar
      expect(repo.getTier('user-idem')).toBe('paid');
    });

    it('upgradeToPaid segunda llamada actualiza upgraded_at', () => {
      const first = new Date('2026-01-01T00:00:00.000Z');
      const second = new Date('2026-06-01T00:00:00.000Z');
      repo.upgradeToPaid('user-ts2', first);
      repo.upgradeToPaid('user-ts2', second);
      const row = db
        .prepare('SELECT upgraded_at FROM subscriptions WHERE user_id = ?')
        .get('user-ts2') as { upgraded_at: string };
      expect(row.upgraded_at).toBe('2026-06-01T00:00:00.000Z');
    });
  });
});
