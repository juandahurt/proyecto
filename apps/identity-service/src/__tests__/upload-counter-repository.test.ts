import { createDatabase } from '../service/database';
import {
  createUploadCounterRepository,
  UploadCounterRepository,
} from '../service/upload-counter-repository';
import Database from 'better-sqlite3';

describe('UploadCounterRepository', () => {
  let db: Database.Database;
  let repo: UploadCounterRepository;

  beforeEach(() => {
    db = createDatabase(':memory:');
    repo = createUploadCounterRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('getForMonth', () => {
    it('devuelve 0 cuando no hay fila para ese usuario+mes', () => {
      expect(repo.getForMonth('user-abc', '2026-11')).toBe(0);
    });

    it('devuelve 0 para un usuario distinto aunque otro tenga contador', () => {
      repo.incrementForMonth('user-a', '2026-11');
      expect(repo.getForMonth('user-b', '2026-11')).toBe(0);
    });
  });

  describe('incrementForMonth', () => {
    it('devuelve 1 en la primera invocacion', () => {
      expect(repo.incrementForMonth('user-abc', '2026-11')).toBe(1);
    });

    it('devuelve 2 en la segunda invocacion', () => {
      repo.incrementForMonth('user-abc', '2026-11');
      expect(repo.incrementForMonth('user-abc', '2026-11')).toBe(2);
    });

    it('getForMonth refleja el contador tras incrementos', () => {
      repo.incrementForMonth('user-abc', '2026-11');
      repo.incrementForMonth('user-abc', '2026-11');
      repo.incrementForMonth('user-abc', '2026-11');
      expect(repo.getForMonth('user-abc', '2026-11')).toBe(3);
    });

    it('dos usuarios independientes: incrementar uno no afecta al otro', () => {
      repo.incrementForMonth('user-a', '2026-11');
      repo.incrementForMonth('user-a', '2026-11');
      repo.incrementForMonth('user-b', '2026-11');
      expect(repo.getForMonth('user-a', '2026-11')).toBe(2);
      expect(repo.getForMonth('user-b', '2026-11')).toBe(1);
    });

    it('dos meses del mismo usuario son contadores independientes', () => {
      repo.incrementForMonth('user-a', '2026-11');
      repo.incrementForMonth('user-a', '2026-11');
      repo.incrementForMonth('user-a', '2026-12');
      expect(repo.getForMonth('user-a', '2026-11')).toBe(2);
      expect(repo.getForMonth('user-a', '2026-12')).toBe(1);
    });

    it('incrementForMonth alcanza 10 correctamente', () => {
      for (let i = 0; i < 10; i++) {
        repo.incrementForMonth('user-abc', '2026-11');
      }
      expect(repo.getForMonth('user-abc', '2026-11')).toBe(10);
    });

    it('lanza error si RETURNING devuelve undefined (guard defensivo)', () => {
      const fakeDb = {
        prepare: (sql: string) => {
          if (sql.includes('RETURNING')) {
            return { get: () => undefined };
          }
          return db.prepare(sql);
        },
      } as unknown as Database.Database;
      const fakeRepo = createUploadCounterRepository(fakeDb);
      expect(() => fakeRepo.incrementForMonth('user-abc', '2026-11')).toThrow(
        'UPSERT RETURNING failed'
      );
    });
  });
});
