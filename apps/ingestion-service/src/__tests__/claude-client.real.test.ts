/**
 * Rama real de callClaudeVision con el SDK simulado (jest.mock). Sin red.
 */
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {}
  class APIUserAbortError extends APIError {}
  class APIConnectionError extends APIError {}
  class APIConnectionTimeoutError extends APIConnectionError {}
  const Ctor = jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } }));
  Object.assign(Ctor, {
    APIError,
    APIUserAbortError,
    APIConnectionError,
    APIConnectionTimeoutError,
  });
  return { __esModule: true, default: Ctor };
});

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeVisionResponseSchema } from '@proyecto/shared-types';
import { callClaudeVision } from '../service/claude-client';
import { AnthropicIntegrationError } from '../service/anthropic-error';

const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const NAMES = ['Composition', 'Proportions', 'Line Quality', 'Values (Shading)', 'Perspective'];
const validJson = (over: object = {}) =>
  JSON.stringify({
    confidence: 'HIGH',
    categories: NAMES.map((name, i) => ({
      id: `CAT-${i + 1}`,
      name,
      score: 60,
      feedback: 'Fine. Keep going.',
    })),
    ...over,
  });
const textResp = (text: string) => ({ content: [{ type: 'text', text }] });

async function kindOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(AnthropicIntegrationError);
    return (e as AnthropicIntegrationError).kind;
  }
  throw new Error('expected rejection');
}

describe('callClaudeVision (rama real, SDK simulado)', () => {
  const origKey = process.env.ANTHROPIC_API_KEY;
  const origTimeout = process.env.CLAUDE_TIMEOUT_MS;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
    delete process.env.CLAUDE_TIMEOUT_MS;
    mockCreate.mockReset();
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (origKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = origKey;
    if (origTimeout === undefined) delete process.env.CLAUDE_TIMEOUT_MS;
    else process.env.CLAUDE_TIMEOUT_MS = origTimeout;
  });

  it('respuesta válida → resultado parseado', async () => {
    mockCreate.mockResolvedValue(textResp(validJson()));
    const r = await callClaudeVision(buf);
    expect(ClaudeVisionResponseSchema.safeParse(r).success).toBe(true);
    expect(r.categories).toHaveLength(5);
  });

  it('kind timeout — APIConnectionTimeoutError', async () => {
    mockCreate.mockRejectedValue(new Anthropic.APIConnectionTimeoutError());
    expect(await kindOf(callClaudeVision(buf))).toBe('timeout');
  });

  it('kind timeout — APIUserAbortError (lo que lanza el SDK al disparar AbortSignal.timeout)', async () => {
    mockCreate.mockRejectedValue(new Anthropic.APIUserAbortError());
    expect(await kindOf(callClaudeVision(buf))).toBe('timeout');
  });

  it('kind timeout — DOMException TimeoutError', async () => {
    mockCreate.mockRejectedValue(new DOMException('x', 'TimeoutError'));
    expect(await kindOf(callClaudeVision(buf))).toBe('timeout');
  });

  it('kind network — error de conexión', async () => {
    mockCreate.mockRejectedValue(new Anthropic.APIConnectionError({ message: 'ECONNRESET' }));
    expect(await kindOf(callClaudeVision(buf))).toBe('network');
  });

  it('kind network — 5xx / error genérico del SDK', async () => {
    mockCreate.mockRejectedValue(new Error('500 Internal Server Error'));
    expect(await kindOf(callClaudeVision(buf))).toBe('network');
  });

  it('kind bad-response — sin bloque de texto', async () => {
    mockCreate.mockResolvedValue({ content: [] });
    expect(await kindOf(callClaudeVision(buf))).toBe('bad-response');
  });

  it('kind bad-response — JSON no parseable', async () => {
    mockCreate.mockResolvedValue(textResp('esto no es json'));
    expect(await kindOf(callClaudeVision(buf))).toBe('bad-response');
  });

  it('kind bad-response — schema inválido', async () => {
    mockCreate.mockResolvedValue(textResp(validJson({ categories: [] })));
    expect(await kindOf(callClaudeVision(buf))).toBe('bad-response');
  });

  describe('CLAUDE_TIMEOUT_MS', () => {
    async function timeoutUsed(): Promise<number> {
      const spy = jest.spyOn(AbortSignal, 'timeout');
      mockCreate.mockResolvedValue(textResp(validJson()));
      await callClaudeVision(buf);
      return spy.mock.calls[0][0];
    }
    it('valor válido se usa', async () => {
      process.env.CLAUDE_TIMEOUT_MS = '1234';
      expect(await timeoutUsed()).toBe(1234);
    });
    it('ausente → 30000', async () => {
      expect(await timeoutUsed()).toBe(30000);
    });
    it.each(['abc', '0', '-5', '1.5'])('%s → 30000', async (v) => {
      process.env.CLAUDE_TIMEOUT_MS = v;
      expect(await timeoutUsed()).toBe(30000);
    });
  });

  it('PNG y WebP se detectan por magic number (media_type)', async () => {
    mockCreate.mockResolvedValue(textResp(validJson()));
    await callClaudeVision(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    await callClaudeVision(Buffer.from([0x52, 0x49, 0x46, 0x46]));
    const types = mockCreate.mock.calls.map((c) => c[0].messages[0].content[0].source.media_type);
    expect(types).toEqual(['image/png', 'image/webp']);
  });
});
