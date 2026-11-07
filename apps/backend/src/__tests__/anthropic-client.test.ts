import { AnthropicClient } from '../service/anthropic-client';
import { AnthropicIntegrationError } from '../service/anthropic-error';
import { CritiqueResponseSchema } from '@proyecto/shared-types';

describe('AnthropicClient (stub)', () => {
  describe('happy path — camino feliz', () => {
    it('critique() resuelve con CritiqueResponse que valida el schema', async () => {
      const client = new AnthropicClient();
      const result = await client.critique('foto cualquiera');
      const parsed = CritiqueResponseSchema.parse(result);
      expect(parsed.categories.length).toBeGreaterThanOrEqual(1);
      expect(typeof parsed.summary).toBe('string');
      expect(parsed.summary.length).toBeGreaterThan(0);
    });
  });

  describe('contract — contrato del schema (rechaza respuestas malformadas)', () => {
    it('safeParse rejects when summary is empty string and categories is empty array', () => {
      const result = CritiqueResponseSchema.safeParse({ summary: '', categories: [] });
      expect(result.success).toBe(false);
    });

    it('parse throws ZodError when summary is a number instead of string — invalid input rejects schema', () => {
      expect(() => CritiqueResponseSchema.parse({ summary: 123, categories: [] })).toThrow();
    });

    it('safeParse rejects when category score is out of range 0-10 — contract validation', () => {
      const result = CritiqueResponseSchema.safeParse({
        summary: 'valid',
        categories: [{ name: 'test', score: 15, comment: 'too high' }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('error path — camino de error (AnthropicIntegrationError)', () => {
    it('critique() rejects with AnthropicIntegrationError when scenario is "error"', async () => {
      const client = new AnthropicClient({ scenario: 'error' });
      await expect(client.critique('any input')).rejects.toBeInstanceOf(AnthropicIntegrationError);
    });

    it('error scenario produces AnthropicIntegrationError with kind "stub-error"', async () => {
      const client = new AnthropicClient({ scenario: 'error' });
      try {
        await client.critique('any input');
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AnthropicIntegrationError);
        expect((err as AnthropicIntegrationError).kind).toBe('stub-error');
      }
    });

    it('AnthropicIntegrationError preserves cause when provided — error path branch', () => {
      const originalCause = new Error('original error');
      const error = new AnthropicIntegrationError('stub-error', 'test message', originalCause);
      expect(error.cause).toBe(originalCause);
      expect(error.kind).toBe('stub-error');
      expect(error instanceof Error).toBe(true);
    });
  });
});
