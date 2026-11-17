import { ClaudeVisionResponse } from '@proyecto/shared-types';
import { AnthropicIntegrationError } from '../service/anthropic-error';
import { resolveCritique } from '../service/critique-outcome';

const NAMES = ['Composition', 'Proportions', 'Line Quality', 'Values (Shading)', 'Perspective'];

function valid(confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH'): ClaudeVisionResponse {
  return {
    confidence,
    categories: NAMES.map((name, i) => ({
      id: `CAT-${i + 1}` as ClaudeVisionResponse['categories'][number]['id'],
      name: name as ClaudeVisionResponse['categories'][number]['name'],
      score: 50 + i,
      feedback: 'Some feedback. More feedback.',
    })),
  };
}

const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const run = (c: unknown) => resolveCritique(c as () => Promise<ClaudeVisionResponse>, buf);

describe('resolveCritique', () => {
  it('HIGH válido → ready', async () => {
    const r = await run(async () => valid('HIGH'));
    expect(r).toEqual({ kind: 'ready', critique: valid('HIGH') });
  });
  it('MEDIUM válido → ready', async () => {
    const r = await run(async () => valid('MEDIUM'));
    expect(r.kind).toBe('ready');
  });
  it('LOW válido → fallback low_confidence_flag', async () => {
    expect(await run(async () => valid('LOW'))).toEqual({
      kind: 'fallback',
      reason: 'low_confidence_flag',
    });
  });
  it('4 categorías → invalid_schema', async () => {
    const v = valid();
    v.categories = v.categories.slice(0, 4);
    expect(await run(async () => v)).toEqual({ kind: 'fallback', reason: 'invalid_schema' });
  });
  it('score 101 → invalid_schema', async () => {
    const v = valid();
    v.categories[0].score = 101;
    expect(await run(async () => v)).toEqual({ kind: 'fallback', reason: 'invalid_schema' });
  });
  it('score -1 → invalid_schema', async () => {
    const v = valid();
    v.categories[2].score = -1;
    expect(await run(async () => v)).toEqual({ kind: 'fallback', reason: 'invalid_schema' });
  });
  it('inválido y LOW → invalid_schema (orden de reglas)', async () => {
    const v = valid('LOW');
    v.categories = v.categories.slice(0, 3);
    expect(await run(async () => v)).toEqual({ kind: 'fallback', reason: 'invalid_schema' });
  });
  it('AnthropicIntegrationError timeout → fallback timeout', async () => {
    const c = async () => {
      throw new AnthropicIntegrationError('timeout', 't');
    };
    expect(await run(c)).toEqual({ kind: 'fallback', reason: 'timeout' });
  });
  it('AnthropicIntegrationError network → fallback timeout (D-1)', async () => {
    const c = async () => {
      throw new AnthropicIntegrationError('network', 'n');
    };
    expect(await run(c)).toEqual({ kind: 'fallback', reason: 'timeout' });
  });
  it('AnthropicIntegrationError bad-response → fallback invalid_schema', async () => {
    const c = async () => {
      throw new AnthropicIntegrationError('bad-response', 'b');
    };
    expect(await run(c)).toEqual({ kind: 'fallback', reason: 'invalid_schema' });
  });
  it('Error genérico → se re-lanza el mismo error', async () => {
    const boom = new Error('bug');
    await expect(
      run(async () => {
        throw boom;
      })
    ).rejects.toBe(boom);
  });
  it('AnthropicIntegrationError conserva kind y cause', () => {
    const cause = new Error('x');
    const e = new AnthropicIntegrationError('network', 'm', cause);
    expect(e.kind).toBe('network');
    expect(e.cause).toBe(cause);
    expect(e.name).toBe('AnthropicIntegrationError');
    expect(e).toBeInstanceOf(Error);
  });
});
