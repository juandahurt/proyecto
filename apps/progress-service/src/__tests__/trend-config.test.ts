import { loadTrendConfig } from '../service/trend-config';

describe('loadTrendConfig', () => {
  it('sin variables -> mínimo 4, mejora +2, empeoramiento -2', () => {
    expect(loadTrendConfig({})).toEqual({ minUploads: 4, slopeImproving: 2, slopeWorsening: -2 });
  });
  it('lee las tres variables', () => {
    expect(
      loadTrendConfig({
        TREND_MIN_UPLOADS: '6',
        TREND_SLOPE_IMPROVING: '1.5',
        TREND_SLOPE_WORSENING: '-0.5',
      })
    ).toEqual({ minUploads: 6, slopeImproving: 1.5, slopeWorsening: -0.5 });
  });
  it('acepta umbrales iguales (mejora == empeoramiento)', () => {
    expect(loadTrendConfig({ TREND_SLOPE_IMPROVING: '0', TREND_SLOPE_WORSENING: '0' })).toEqual({
      minUploads: 4,
      slopeImproving: 0,
      slopeWorsening: 0,
    });
  });

  const casos: Array<[string, Record<string, string>, string]> = [
    ['mínimo no numérico', { TREND_MIN_UPLOADS: 'abc' }, 'TREND_MIN_UPLOADS'],
    ['mínimo vacío', { TREND_MIN_UPLOADS: '' }, 'TREND_MIN_UPLOADS'],
    ['mínimo menor que 2', { TREND_MIN_UPLOADS: '1' }, 'TREND_MIN_UPLOADS'],
    ['mínimo no entero', { TREND_MIN_UPLOADS: '3.5' }, 'TREND_MIN_UPLOADS'],
    ['mejora no numérica', { TREND_SLOPE_IMPROVING: 'x' }, 'TREND_SLOPE_IMPROVING'],
    ['mejora vacía', { TREND_SLOPE_IMPROVING: '  ' }, 'TREND_SLOPE_IMPROVING'],
    ['empeoramiento no numérico', { TREND_SLOPE_WORSENING: 'NaN' }, 'TREND_SLOPE_WORSENING'],
    ['empeoramiento infinito', { TREND_SLOPE_WORSENING: 'Infinity' }, 'TREND_SLOPE_WORSENING'],
    [
      'mejora menor que empeoramiento',
      { TREND_SLOPE_IMPROVING: '-3', TREND_SLOPE_WORSENING: '-2' },
      'TREND_SLOPE_IMPROVING',
    ],
  ];
  it.each(casos)('rechaza %s nombrando la variable', (_n, env, variable) => {
    expect(() => loadTrendConfig(env)).toThrow(variable);
  });

  it('el mensaje no repite el valor inválido', () => {
    let msg = '';
    try {
      loadTrendConfig({ TREND_MIN_UPLOADS: 'valor-raro-xyz' });
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).toContain('TREND_MIN_UPLOADS');
    expect(msg).not.toContain('valor-raro-xyz');
  });
});
