import Database from 'better-sqlite3';

export interface SubscriptionRepository {
  getTier(userId: string): 'free' | 'paid';
  upgradeToPaid(userId: string, now?: Date): void;
}

interface SubscriptionRow {
  tier: string;
}

export function createSubscriptionRepository(db: Database.Database): SubscriptionRepository {
  const selectStmt = db.prepare<[string], SubscriptionRow>(
    'SELECT tier FROM subscriptions WHERE user_id = ?'
  );

  const upsertStmt = db.prepare<[string, string]>(
    `INSERT INTO subscriptions(user_id, tier, upgraded_at) VALUES (?, 'paid', ?)
     ON CONFLICT(user_id) DO UPDATE SET tier = 'paid', upgraded_at = excluded.upgraded_at`
  );

  return {
    getTier(userId: string): 'free' | 'paid' {
      const row = selectStmt.get(userId);
      if (!row) return 'free';
      return row.tier === 'paid' ? 'paid' : 'free';
    },

    upgradeToPaid(userId: string, now?: Date): void {
      const ts = (now ?? new Date()).toISOString();
      upsertStmt.run(userId, ts);
    },
  };
}
