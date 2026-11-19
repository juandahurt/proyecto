import {
  CATEGORY_NAME_BY_ID,
  CategoryTrendCalc,
  CategoryTrendSchema,
  TrendPoint,
  TrendResponseSchema,
} from '@proyecto/shared-types';
import { buildTrendResponse } from '../service/trend-response';

const point = (n: number): TrendPoint => ({
  uploadId: `${n}${n}${n}${n}${n}${n}${n}${n}-${n}${n}${n}${n}-4${n}${n}${n}-8${n}${n}${n}-${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}`,
  score: 10 * n,
  timestamp: `2026-11-0${n}T10:00:00.000Z`,
});
const series = [point(1), point(2), point(3), point(4)];

function calcs(): CategoryTrendCalc[] {
  return [
    {
      categoryId: 'CAT-1',
      status: 'improving',
      qualifiedCount: 4,
      uploadsNeeded: 0,
      slope: 10,
      series,
    },
    {
      categoryId: 'CAT-2',
      status: 'stagnating',
      qualifiedCount: 4,
      uploadsNeeded: 0,
      slope: 0.5,
      series,
    },
    {
      categoryId: 'CAT-3',
      status: 'worsening',
      qualifiedCount: 4,
      uploadsNeeded: 0,
      slope: -9,
      series,
    },
    { categoryId: 'CAT-4', status: 'insufficient_data', qualifiedCount: 1, uploadsNeeded: 3 },
    { categoryId: 'CAT-5', status: 'insufficient_data', qualifiedCount: 3, uploadsNeeded: 1 },
  ];
}

describe('buildTrendResponse', () => {
  describe('tier free (AC-7.1: puerta de datos)', () => {
    it('improving, stagnating y worsening salen locked sin trend ni uploadsNeeded', () => {
      const out = buildTrendResponse('free', calcs());
      expect(out.data.tier).toBe('free');
      expect(out.data.categories.slice(0, 3)).toEqual([
        { categoryId: 'CAT-1', categoryName: 'Composition', status: 'locked' },
        { categoryId: 'CAT-2', categoryName: 'Proportions', status: 'locked' },
        { categoryId: 'CAT-3', categoryName: 'Line Quality', status: 'locked' },
      ]);
    });

    it('insufficient_data se queda como esta, con su uploadsNeeded', () => {
      const out = buildTrendResponse('free', calcs());
      expect(out.data.categories.slice(3)).toEqual([
        {
          categoryId: 'CAT-4',
          categoryName: 'Values (Shading)',
          status: 'insufficient_data',
          uploadsNeeded: 3,
        },
        {
          categoryId: 'CAT-5',
          categoryName: 'Perspective',
          status: 'insufficient_data',
          uploadsNeeded: 1,
        },
      ]);
    });

    it('el cuerpo serializado no contiene direccion, historial ni slope (free)', () => {
      const raw = JSON.stringify(buildTrendResponse('free', calcs()));
      for (const forbidden of [
        'improving',
        'stagnating',
        'worsening',
        'scoreHistory',
        'slope',
        'score',
        'uploadId',
        series[0].uploadId,
        series[0].timestamp,
      ]) {
        expect(raw).not.toContain(forbidden);
      }
    });
  });

  describe('tier paid (AC-7.2: formato C3)', () => {
    it('devuelve las 5 categorias en orden CAT-1..5 con su categoryName', () => {
      const out = buildTrendResponse('paid', calcs());
      expect(out.data.tier).toBe('paid');
      expect(out.data.categories.map((c) => [c.categoryId, c.categoryName])).toEqual([
        ['CAT-1', 'Composition'],
        ['CAT-2', 'Proportions'],
        ['CAT-3', 'Line Quality'],
        ['CAT-4', 'Values (Shading)'],
        ['CAT-5', 'Perspective'],
      ]);
    });

    it('con tendencia: trend.direction === status y scoreHistory es series tal cual (cronologico)', () => {
      const out = buildTrendResponse('paid', calcs());
      expect(out.data.categories[0]).toEqual({
        categoryId: 'CAT-1',
        categoryName: 'Composition',
        status: 'improving',
        trend: { direction: 'improving', scoreHistory: series },
      });
      expect(out.data.categories[1].trend?.direction).toBe('stagnating');
      expect(out.data.categories[2].trend?.direction).toBe('worsening');
      expect(out.data.categories[0].trend?.scoreHistory.map((p) => p.score)).toEqual([
        10, 20, 30, 40,
      ]);
    });

    it('insufficient_data: uploadsNeeded y sin trend', () => {
      const out = buildTrendResponse('paid', calcs());
      expect(out.data.categories[3]).toEqual({
        categoryId: 'CAT-4',
        categoryName: 'Values (Shading)',
        status: 'insufficient_data',
        uploadsNeeded: 3,
      });
      expect('trend' in out.data.categories[4]).toBe(false);
    });

    it('slope y qualifiedCount no se exponen', () => {
      const raw = JSON.stringify(buildTrendResponse('paid', calcs()));
      expect(raw).not.toContain('slope');
      expect(raw).not.toContain('qualifiedCount');
    });
  });

  it('la salida valida contra TrendResponseSchema (free y paid)', () => {
    expect(TrendResponseSchema.safeParse(buildTrendResponse('free', calcs())).success).toBe(true);
    expect(TrendResponseSchema.safeParse(buildTrendResponse('paid', calcs())).success).toBe(true);
  });

  it('defensivo: una tendencia sin series (no ocurre con el calculo real) da historial vacio, nunca lanza', () => {
    const calc: CategoryTrendCalc = {
      categoryId: 'CAT-1',
      status: 'improving',
      qualifiedCount: 4,
      uploadsNeeded: 0,
      slope: 3,
    };
    const out = buildTrendResponse('paid', [calc]);
    expect(out.data.categories[0].trend).toEqual({ direction: 'improving', scoreHistory: [] });
  });

  it('CATEGORY_NAME_BY_ID cubre las 5 categorias', () => {
    expect(Object.keys(CATEGORY_NAME_BY_ID)).toEqual(['CAT-1', 'CAT-2', 'CAT-3', 'CAT-4', 'CAT-5']);
  });
});

describe('CategoryTrendSchema (refine)', () => {
  const base = { categoryId: 'CAT-1', categoryName: 'Composition' };
  const trend = { direction: 'improving', scoreHistory: series };

  it('rechaza trend en locked', () => {
    expect(CategoryTrendSchema.safeParse({ ...base, status: 'locked', trend }).success).toBe(false);
  });
  it('rechaza trend en insufficient_data', () => {
    expect(
      CategoryTrendSchema.safeParse({ ...base, status: 'insufficient_data', trend }).success
    ).toBe(false);
  });
  it('rechaza uploadsNeeded fuera de insufficient_data (locked y con tendencia)', () => {
    expect(
      CategoryTrendSchema.safeParse({ ...base, status: 'locked', uploadsNeeded: 1 }).success
    ).toBe(false);
    expect(
      CategoryTrendSchema.safeParse({ ...base, status: 'improving', trend, uploadsNeeded: 0 })
        .success
    ).toBe(false);
  });
  it('rechaza direction distinta de status y status con tendencia sin trend', () => {
    expect(CategoryTrendSchema.safeParse({ ...base, status: 'worsening', trend }).success).toBe(
      false
    );
    expect(CategoryTrendSchema.safeParse({ ...base, status: 'improving' }).success).toBe(false);
  });
  it('acepta las cuatro formas validas', () => {
    expect(CategoryTrendSchema.safeParse({ ...base, status: 'locked' }).success).toBe(true);
    expect(
      CategoryTrendSchema.safeParse({ ...base, status: 'insufficient_data', uploadsNeeded: 2 })
        .success
    ).toBe(true);
    expect(CategoryTrendSchema.safeParse({ ...base, status: 'improving', trend }).success).toBe(
      true
    );
  });
  it('rechaza uploadsNeeded negativo o no entero', () => {
    expect(
      CategoryTrendSchema.safeParse({ ...base, status: 'insufficient_data', uploadsNeeded: -1 })
        .success
    ).toBe(false);
    expect(
      CategoryTrendSchema.safeParse({ ...base, status: 'insufficient_data', uploadsNeeded: 1.5 })
        .success
    ).toBe(false);
  });
});
