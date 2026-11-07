import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../server';
import { createDatabase } from '../service/database';
import { CritiqueRepository } from '../service/critique-repository';
import { AnthropicClient } from '../service/anthropic-client';
import { CritiqueResponseSchema } from '@proyecto/shared-types';

describe('POST /critiques', () => {
  let app: Application;
  let db: ReturnType<typeof createDatabase>;
  let repo: CritiqueRepository;

  beforeEach(() => {
    db = createDatabase(':memory:');
    repo = new CritiqueRepository(db);
    const client = new AnthropicClient({ scenario: 'success' });
    app = createApp({ client, repo });
  });

  afterEach(() => {
    db.close();
  });

  describe('camino feliz — POST 200', () => {
    it('POST /critiques with valid input returns 200 with {data:{id, response}, error:null, status:200}', async () => {
      const res = await request(app)
        .post('/critiques')
        .send({ input: 'una imagen de prueba del skeleton' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.error).toBeNull();
      expect(res.body.status).toBe(200);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('response');
      expect(typeof res.body.data.id).toBe('number');
      expect(res.body.data.id).toBeGreaterThan(0);

      // Lectura de vuelta: el registro debe estar en la BD con los mismos datos
      const persisted = repo.getById(res.body.data.id);
      expect(persisted).not.toBeNull();
      expect(persisted!.input).toBe('una imagen de prueba del skeleton');
      expect(persisted!.response).toEqual(res.body.data.response);
    });

    it('response.data.response pasa CritiqueResponseSchema.parse sin lanzar', async () => {
      const res = await request(app)
        .post('/critiques')
        .send({ input: 'foto para schema check' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(() => CritiqueResponseSchema.parse(res.body.data.response)).not.toThrow();
    });
  });

  describe('camino de error — input invalido (400)', () => {
    it('POST /critiques without body returns 400 with {data:null, error:string, status:400}', async () => {
      const res = await request(app).post('/critiques').set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body.data).toBeNull();
      expect(typeof res.body.error).toBe('string');
      expect(res.body.status).toBe(400);
    });

    it('POST /critiques with empty input string returns 400 — invalid input rejects schema', async () => {
      const res = await request(app)
        .post('/critiques')
        .send({ input: '' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body.data).toBeNull();
      expect(typeof res.body.error).toBe('string');
      expect(res.body.status).toBe(400);
    });
  });

  describe('camino de error — Anthropic falla (502)', () => {
    it('POST /critiques with scenario "error" returns 502 — anthropic integration error maps to 502', async () => {
      const errorClient = new AnthropicClient({ scenario: 'error' });
      const errorApp = createApp({ client: errorClient, repo });

      const res = await request(errorApp)
        .post('/critiques')
        .send({ input: 'foto que causa error en anthropic' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(502);
      expect(res.body.data).toBeNull();
      expect(res.body.error).toBe('anthropic integration error');
      expect(res.body.status).toBe(502);
    });
  });
});
