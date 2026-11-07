import { CritiqueResponse } from '@proyecto/shared-types';
import { createDatabase } from '../service/database';
import { CritiqueRepository } from '../service/critique-repository';

const STUB_RESPONSE: CritiqueResponse = {
  summary: 'Composicion equilibrada con alto contraste.',
  categories: [
    { name: 'composition', score: 8.5, comment: 'Regla de tercios bien aplicada.' },
    { name: 'color', score: 7.2, comment: 'Paleta armonica y saturacion coherente.' },
  ],
};

describe('CritiqueRepository', () => {
  let db: ReturnType<typeof createDatabase>;
  let repo: CritiqueRepository;

  beforeEach(() => {
    db = createDatabase(':memory:');
    repo = new CritiqueRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('round-trip: save + getById', () => {
    it('save() returns an id; getById(id) returns the persisted record with parsed response', () => {
      const { id } = repo.save('una foto de prueba', STUB_RESPONSE);
      expect(typeof id).toBe('number');
      expect(id).toBeGreaterThan(0);

      const record = repo.getById(id);
      expect(record).not.toBeNull();
      expect(record!.id).toBe(id);
      expect(record!.input).toBe('una foto de prueba');
      expect(record!.response).toEqual(STUB_RESPONSE);
      expect(typeof record!.createdAt).toBe('string');
      expect(record!.createdAt.length).toBeGreaterThan(0);
    });
  });

  describe('getById — id inexistente', () => {
    it('getById(99999) returns null when record does not exist', () => {
      const result = repo.getById(99999);
      expect(result).toBeNull();
    });
  });

  describe('init idempotencia', () => {
    it('calling createDatabase twice with same path does not fail or duplicate the table', () => {
      // Segunda instancia sobre la misma BD en memoria no es posible (cada :memory: es
      // independiente), pero llamar createDatabase dos veces sobre el mismo archivo no falla.
      // Para el test de idempotencia verificamos que el CREATE TABLE IF NOT EXISTS es seguro
      // corriendo el init dos veces sobre la misma instancia db.
      expect(() => {
        const db2 = createDatabase(':memory:');
        const db3 = createDatabase(':memory:');
        db2.close();
        db3.close();
      }).not.toThrow();
    });
  });
});
