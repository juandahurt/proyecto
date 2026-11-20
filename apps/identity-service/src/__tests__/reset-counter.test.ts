import request from 'supertest';
import { createApp } from '../server';
import { createDatabase } from '../service/database';
import { createUserRepository } from '../service/user-repository';
import { createUploadCounterRepository } from '../service/upload-counter-repository';
import { currentYearMonth } from '../service/clock';

const VALID_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

function url(userId: string): string {
  return `/api/internal/users/${userId}/reset-counter`;
}

function makeApp() {
  const db = createDatabase(':memory:');
  const repo = createUserRepository(db);
  const counterRepo = createUploadCounterRepository(db);
  return { app: createApp({ db, repo, counterRepo }), db, counterRepo };
}

describe('POST /api/internal/users/:userId/reset-counter', () => {
  it('CA-4: usuario con count=7 en el mes en curso -> 204 y getForMonth da 0', async () => {
    const { app, counterRepo } = makeApp();
    const thisMonth = currentYearMonth();
    for (let i = 0; i < 7; i++) counterRepo.incrementForMonth(VALID_UUID, thisMonth);
    expect(counterRepo.getForMonth(VALID_UUID, thisMonth)).toBe(7);

    const res = await request(app).post(url(VALID_UUID));
    expect(res.status).toBe(204);
    expect(counterRepo.getForMonth(VALID_UUID, thisMonth)).toBe(0);
  });

  it('CA-4: usuario sin fila de contador -> 204, y getForMonth sigue en 0 (no crea negativo, no lanza)', async () => {
    const { app, counterRepo } = makeApp();
    const res = await request(app).post(url(VALID_UUID));
    expect(res.status).toBe(204);
    expect(counterRepo.getForMonth(VALID_UUID, currentYearMonth())).toBe(0);
  });

  it('CA-4: el mes anterior no se toca (mutación: resetear todo haría fallar esto)', async () => {
    const { app, db, counterRepo } = makeApp();
    const thisMonth = currentYearMonth();
    for (let i = 0; i < 5; i++) counterRepo.incrementForMonth(VALID_UUID, thisMonth);

    const previousMonth = '2020-01';
    db.prepare('INSERT INTO upload_counters (user_id, year_month, count) VALUES (?, ?, ?)').run(
      VALID_UUID,
      previousMonth,
      3
    );

    const res = await request(app).post(url(VALID_UUID));
    expect(res.status).toBe(204);
    expect(counterRepo.getForMonth(VALID_UUID, thisMonth)).toBe(0);
    expect(counterRepo.getForMonth(VALID_UUID, previousMonth)).toBe(3);
  });
});
