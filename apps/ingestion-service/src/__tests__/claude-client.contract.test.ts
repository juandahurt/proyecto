/**
 * Contract test para callClaudeVision (C10).
 *
 * Verifica que la función stub (sin ANTHROPIC_API_KEY) devuelve un objeto
 * que pasa la validación del schema ClaudeVisionResponseSchema.
 *
 * También verifica la rama real (con ANTHROPIC_API_KEY definida) mediante
 * mocking del SDK de Anthropic para evitar llamadas a la red.
 *
 * CA-5: suite pasa, 0 failures. El test valida schema con safeParse.
 */
import { ClaudeVisionResponseSchema } from '@proyecto/shared-types';

// Mock del SDK de Anthropic ANTES de importar claude-client
// (jest.mock se hoista al principio del archivo)
const mockMessagesCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: mockMessagesCreate,
      },
    })),
  };
});

import { callClaudeVision } from '../service/claude-client';

/** Buffer JPEG mínimo (magic number FF D8 FF E0) para pasar validación si hubiera. */
const MINIMAL_JPEG_BUFFER = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

/** Buffer PNG mínimo (magic number 89 50 4E 47). */
const MINIMAL_PNG_BUFFER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Buffer WebP mínimo (magic number 52 49 46 46). */
const MINIMAL_WEBP_BUFFER = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]);

/** Respuesta de Claude schema-válida para usar en mocks */
const VALID_CLAUDE_API_RESPONSE = {
  confidence: 'HIGH',
  categories: [
    {
      id: 'CAT-1',
      name: 'Composition',
      score: 72,
      feedback: 'Good composition. Try rule of thirds.',
    },
    {
      id: 'CAT-2',
      name: 'Proportions',
      score: 68,
      feedback: 'Mostly accurate. Minor discrepancies.',
    },
    {
      id: 'CAT-3',
      name: 'Line Quality',
      score: 75,
      feedback: 'Confident lines. Vary line weight.',
    },
    {
      id: 'CAT-4',
      name: 'Values (Shading)',
      score: 60,
      feedback: 'Basic shading. Expand value range.',
    },
    {
      id: 'CAT-5',
      name: 'Perspective',
      score: 55,
      feedback: 'Good intent. Use consistent vanishing points.',
    },
  ],
};

describe('callClaudeVision — stub path (sin ANTHROPIC_API_KEY)', () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  beforeAll(() => {
    // Asegurar que ANTHROPIC_API_KEY no está definida para el stub path
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterAll(() => {
    // Restaurar el estado original
    if (originalApiKey !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
  });

  it('CA-5: schema válido sin API key — safeParse retorna success: true', async () => {
    const response = await callClaudeVision(MINIMAL_JPEG_BUFFER);
    const result = ClaudeVisionResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('CA-5: exactamente 5 categories', async () => {
    const response = await callClaudeVision(MINIMAL_JPEG_BUFFER);
    expect(response.categories).toHaveLength(5);
  });

  it('CA-5: IDs correctos — exactamente CAT-1..CAT-5 (sort)', async () => {
    const response = await callClaudeVision(MINIMAL_JPEG_BUFFER);
    const ids = response.categories.map((c) => c.id).sort();
    expect(ids).toEqual(['CAT-1', 'CAT-2', 'CAT-3', 'CAT-4', 'CAT-5']);
  });

  it('CA-5: scores en rango 0-100', async () => {
    const response = await callClaudeVision(MINIMAL_JPEG_BUFFER);
    for (const cat of response.categories) {
      expect(cat.score).toBeGreaterThanOrEqual(0);
      expect(cat.score).toBeLessThanOrEqual(100);
    }
  });

  it('CA-5: feedback no vacío en todas las categorías', async () => {
    const response = await callClaudeVision(MINIMAL_JPEG_BUFFER);
    for (const cat of response.categories) {
      expect(cat.feedback.length).toBeGreaterThan(0);
    }
  });

  it('CA-5: confidence es un valor válido (HIGH, MEDIUM o LOW)', async () => {
    const response = await callClaudeVision(MINIMAL_JPEG_BUFFER);
    expect(['HIGH', 'MEDIUM', 'LOW']).toContain(response.confidence);
  });

  it('CA-5: nombres de categoría son los valores correctos del enum', async () => {
    const validNames = [
      'Composition',
      'Proportions',
      'Line Quality',
      'Values (Shading)',
      'Perspective',
    ];
    const response = await callClaudeVision(MINIMAL_JPEG_BUFFER);
    for (const cat of response.categories) {
      expect(validNames).toContain(cat.name);
    }
  });
});

describe('callClaudeVision — rama real (con ANTHROPIC_API_KEY mock)', () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  beforeAll(() => {
    // Definir API key para activar la rama real
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key-for-unit-tests';
  });

  afterAll(() => {
    // Restaurar estado original
    if (originalApiKey !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  beforeEach(() => {
    mockMessagesCreate.mockReset();
  });

  it('devuelve respuesta schema-válida con JPEG buffer', async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(VALID_CLAUDE_API_RESPONSE) }],
    });

    const response = await callClaudeVision(MINIMAL_JPEG_BUFFER);
    const result = ClaudeVisionResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
    expect(response.confidence).toBe('HIGH');
    expect(response.categories).toHaveLength(5);
  });

  it('detecta media type PNG correctamente', async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(VALID_CLAUDE_API_RESPONSE) }],
    });

    await callClaudeVision(MINIMAL_PNG_BUFFER);

    // Verificar que el call usó image/png
    const callArg = mockMessagesCreate.mock.calls[0][0];
    const imageContent = callArg.messages[0].content[0];
    expect(imageContent.source.media_type).toBe('image/png');
  });

  it('detecta media type WebP correctamente', async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(VALID_CLAUDE_API_RESPONSE) }],
    });

    await callClaudeVision(MINIMAL_WEBP_BUFFER);

    // Verificar que el call usó image/webp
    const callArg = mockMessagesCreate.mock.calls[0][0];
    const imageContent = callArg.messages[0].content[0];
    expect(imageContent.source.media_type).toBe('image/webp');
  });

  it('usa el modelo correcto claude-3-5-sonnet-20241022', async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(VALID_CLAUDE_API_RESPONSE) }],
    });

    await callClaudeVision(MINIMAL_JPEG_BUFFER);

    const callArg = mockMessagesCreate.mock.calls[0][0];
    expect(callArg.model).toBe('claude-3-5-sonnet-20241022');
  });

  it('lanza error si la respuesta no tiene contenido de texto', async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'toolu_01' }],
    });

    await expect(callClaudeVision(MINIMAL_JPEG_BUFFER)).rejects.toThrow(
      'Claude returned no text content'
    );
  });

  it('lanza error si la respuesta no es JSON válido', async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'not valid json {{' }],
    });

    await expect(callClaudeVision(MINIMAL_JPEG_BUFFER)).rejects.toThrow(
      'Claude response is not valid JSON'
    );
  });

  it('lanza error si la respuesta no cumple el schema C10', async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify({ confidence: 'HIGH', categories: [] }) }],
    });

    await expect(callClaudeVision(MINIMAL_JPEG_BUFFER)).rejects.toThrow(
      'Claude response does not match C10 schema'
    );
  });
});
