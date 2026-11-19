import { FakeIngestion, startFakeIngestion } from './fake-ingestion';

/** Mismo servidor HTTP local en puerto efimero, que aqui hace de identity. */
export type FakeIdentity = FakeIngestion;

export function startFakeIdentity(): Promise<FakeIdentity> {
  return startFakeIngestion();
}

/** Cuerpo real de GET /api/users/me/limits de identity. */
export function limitsBody(tier: string): string {
  const paid = tier === 'paid';
  return JSON.stringify({
    data: {
      tier,
      uploadsRemaining: paid ? null : 3,
      uploadsLimit: paid ? null : 5,
      resetDate: paid ? null : '2026-12-01T00:00:00.000Z',
    },
    error: null,
    status: 200,
  });
}
