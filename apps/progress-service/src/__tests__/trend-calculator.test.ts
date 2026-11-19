import { CategoryTrendCalcSchema, TrendStatus, UploadListItem } from '@proyecto/shared-types';
import { TrendOptions, calculateTrends } from '../service/trend-calculator';

const OPTS: TrendOptions = { minUploads: 4, slopeImproving: 2, slopeWorsening: -2 };

let seq = 0;
function uid(): string {
  seq += 1;
  return `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`;
}

/** Item ready con el mismo score de CAT-1 y scores de relleno en el resto. */
function ready(
  cat1: number,
  extra: { confidence?: 'HIGH' | 'MEDIUM' | 'LOW'; cat2?: number; ts?: string } = {}
): UploadListItem {
  return {
    uploadId: uid(),
    status: 'ready',
    confidence: extra.confidence ?? 'HIGH',
    timestamp: extra.ts ?? '2026-11-01T10:00:00.000Z',
    scores: [
      { categoryId: 'CAT-1', score: cat1 },
      { categoryId: 'CAT-2', score: extra.cat2 ?? 50 },
      { categoryId: 'CAT-3', score: 50 },
      { categoryId: 'CAT-4', score: 50 },
      { categoryId: 'CAT-5', score: 50 },
    ],
  };
}

function low(): UploadListItem {
  return {
    uploadId: uid(),
    status: 'low_confidence',
    confidence: 'LOW',
    timestamp: '2026-11-01T10:00:00.000Z',
    scores: [],
    fallbackReason: 'low_confidence_flag',
  };
}

/** Construye el listado como llega: más reciente primero, a partir de una serie cronológica. */
function listing(chrono: number[]): UploadListItem[] {
  return chrono.map((s) => ready(s)).reverse();
}

function cat1(items: UploadListItem[], opts: TrendOptions = OPTS) {
  return calculateTrends(items, opts)[0];
}

describe('calculateTrends — ejemplos de la historia (FR-6.2, AC-6.1)', () => {
  it('FR-6.2 [54,58,61,65,68,72] -> improving con pendiente ~3,54', () => {
    const r = cat1(listing([54, 58, 61, 65, 68, 72]));
    expect(r.status).toBe('improving');
    expect(r.slope).toBeCloseTo(3.5429, 3);
  });
  it('AC-6.1 [54,58,65,72] -> improving', () => {
    expect(cat1(listing([54, 58, 65, 72])).status).toBe('improving');
  });
  it('serie constante [10,10,10,10] -> pendiente 0, stagnating', () => {
    const r = cat1(listing([10, 10, 10, 10]));
    expect(r.slope).toBe(0);
    expect(r.status).toBe('stagnating');
  });
  it('[0,10,20,30] -> improving (10)', () => {
    const r = cat1(listing([0, 10, 20, 30]));
    expect(r.slope).toBe(10);
    expect(r.status).toBe('improving');
  });
  it('[30,20,10,0] -> worsening (-10)', () => {
    const r = cat1(listing([30, 20, 10, 0]));
    expect(r.slope).toBe(-10);
    expect(r.status).toBe('worsening');
  });
});

describe('calculateTrends — bordes del umbral (exactamente +2 / -2)', () => {
  it('borde [0,2,4,6] pendiente exactamente 2 -> stagnating', () => {
    const r = cat1(listing([0, 2, 4, 6]));
    expect(r.slope).toBe(2);
    expect(r.status).toBe('stagnating');
  });
  it('borde [6,4,2,0] pendiente exactamente -2 -> stagnating', () => {
    const r = cat1(listing([6, 4, 2, 0]));
    expect(r.slope).toBe(-2);
    expect(r.status).toBe('stagnating');
  });
  it('umbral [0,2,4,7] pendiente 2,3 -> improving', () => {
    const r = cat1(listing([0, 2, 4, 7]));
    expect(r.slope).toBeCloseTo(2.3, 10);
    expect(r.status).toBe('improving');
  });
  it('umbral [7,4,2,0] pendiente -2,3 -> worsening', () => {
    const r = cat1(listing([7, 4, 2, 0]));
    expect(r.slope).toBeCloseTo(-2.3, 10);
    expect(r.status).toBe('worsening');
  });
  it('umbrales configurables: con +1 / -1 la serie [0,2,4,6] mejora', () => {
    const r = cat1(listing([0, 2, 4, 6]), { ...OPTS, slopeImproving: 1, slopeWorsening: -1 });
    expect(r.status).toBe('improving');
  });
});

describe('calculateTrends — mínimo de uploads calificados (FR-6.1, FR-6.5, AC-6.2..6.4)', () => {
  it('AC-6.2 3 calificados -> insufficient_data, uploadsNeeded 1, sin slope ni series', () => {
    const r = cat1(listing([10, 20, 30]));
    expect(r.status).toBe(TrendStatus.insufficient);
    expect(r.qualifiedCount).toBe(3);
    expect(r.uploadsNeeded).toBe(1);
    expect('slope' in r).toBe(false);
    expect('series' in r).toBe(false);
  });
  it('4 calificados -> se calcula, uploadsNeeded 0', () => {
    const r = cat1(listing([10, 20, 30, 40]));
    expect(r.status).toBe('improving');
    expect(r.uploadsNeeded).toBe(0);
    expect(r.qualifiedCount).toBe(4);
  });
  it('AC-6.4 3 calificados + un 4.º de baja confianza -> insufficient_data, uploadsNeeded 1', () => {
    const r = cat1([low(), ...listing([10, 20, 30])]);
    expect(r.status).toBe('insufficient_data');
    expect(r.qualifiedCount).toBe(3);
    expect(r.uploadsNeeded).toBe(1);
  });
  it('AC-6.3 4 calificados + 2 de baja confianza -> series con exactamente los 4 calificados, en orden cronológico', () => {
    const a = ready(10);
    const b = ready(20);
    const c = ready(30);
    const d = ready(40);
    const r = cat1([low(), d, c, low(), b, a]);
    expect(r.series).toHaveLength(4);
    expect(r.series?.map((p) => p.score)).toEqual([10, 20, 30, 40]);
    expect(r.series?.map((p) => p.uploadId)).toEqual([a, b, c, d].map((i) => i.uploadId));
  });
  it('mínimo configurable: con minUploads 2 bastan 2 calificados; uploadsNeeded sigue min - n', () => {
    expect(cat1(listing([10, 30]), { ...OPTS, minUploads: 2 }).status).toBe('improving');
    expect(cat1(listing([10]), { ...OPTS, minUploads: 2 }).uploadsNeeded).toBe(1);
  });
  it('un item ready con confianza LOW (defensivo) no cuenta como calificado', () => {
    const items = [ready(40, { confidence: 'LOW' }), ...listing([10, 20, 30])];
    const r = cat1(items);
    expect(r.qualifiedCount).toBe(3);
    expect(r.status).toBe('insufficient_data');
  });
  it.each(['HIGH', 'MEDIUM'] as const)(
    'un item low_confidence con confianza %s y scores presentes no cuenta como calificado',
    (confidence) => {
      const raro: UploadListItem = { ...ready(99), status: 'low_confidence', confidence };
      const r = cat1([raro, ...listing([10, 20, 30])]);
      expect(r.qualifiedCount).toBe(3);
      expect(r.status).toBe('insufficient_data');
      expect(cat1([raro, ...listing([10, 20, 30, 40])]).series?.map((p) => p.score)).toEqual([
        10, 20, 30, 40,
      ]);
    }
  );
  it('confianza MEDIUM sí cuenta como calificada', () => {
    const items = [ready(40, { confidence: 'MEDIUM' }), ...listing([10, 20, 30])];
    expect(cat1(items).qualifiedCount).toBe(4);
  });
  it('un item ready sin score de la categoría no cuenta para esa categoría', () => {
    const sinCat1: UploadListItem = { ...ready(99), scores: [{ categoryId: 'CAT-2', score: 50 }] };
    const r = calculateTrends([sinCat1, ...listing([10, 20, 30])], OPTS);
    expect(r[0].qualifiedCount).toBe(3);
    expect(r[1].qualifiedCount).toBe(4);
  });
});

describe('calculateTrends — categorías independientes, cinco siempre, orden y empates', () => {
  it('independencia: CAT-1 con 4 calificados tiene tendencia y CAT-2 con 3 queda insufficient_data', () => {
    const items = [
      ready(40, { cat2: 40 }),
      ready(30, { cat2: 30 }),
      ready(20, { cat2: 20 }),
      { ...ready(10), scores: ready(10).scores.filter((s) => s.categoryId !== 'CAT-2') },
    ];
    const r = calculateTrends(items, OPTS);
    expect(r[0].status).toBe('improving');
    expect(r[1].status).toBe('insufficient_data');
    expect(r[1].qualifiedCount).toBe(3);
  });
  it('listado vacío -> cinco entradas insufficient_data con qualifiedCount 0 y uploadsNeeded 4', () => {
    const r = calculateTrends([], OPTS);
    expect(r.map((x) => x.categoryId)).toEqual(['CAT-1', 'CAT-2', 'CAT-3', 'CAT-4', 'CAT-5']);
    for (const x of r) {
      expect(x.status).toBe('insufficient_data');
      expect(x.qualifiedCount).toBe(0);
      expect(x.uploadsNeeded).toBe(4);
    }
  });
  it('el resultado va siempre en orden CAT-1..CAT-5 aunque los scores vengan desordenados', () => {
    const it1 = ready(10);
    const desordenado = { ...it1, scores: [...it1.scores].reverse() };
    const r = calculateTrends([desordenado], OPTS);
    expect(r.map((x) => x.categoryId)).toEqual(['CAT-1', 'CAT-2', 'CAT-3', 'CAT-4', 'CAT-5']);
  });
  it('orden cronológico: la serie es el listado invertido (dirección correcta)', () => {
    // Listado reciente primero: 72 ... 54 => mejora; si no se invirtiera sería worsening
    const r = cat1(listing([54, 58, 61, 65]));
    expect(r.series?.map((p) => p.score)).toEqual([54, 58, 61, 65]);
    expect(r.status).toBe('improving');
    expect(r.slope).toBeGreaterThan(0);
  });
  it('empate de timestamps: no se reordena por timestamp, manda el orden del listado', () => {
    const same = '2026-11-01T10:00:00.000Z';
    const items = [60, 50, 40, 30, 20, 10].map((s) => ready(s, { ts: same }));
    const r = cat1(items);
    expect(r.series?.map((p) => p.score)).toEqual([10, 20, 30, 40, 50, 60]);
    expect(r.status).toBe('improving');
  });
  it('los timestamps de la serie se conservan tal cual', () => {
    const items = [ready(40, { ts: '2026-11-04T00:00:00.000Z' }), ...listing([10, 20, 30])];
    const r = cat1(items);
    expect(r.series?.[3].timestamp).toBe('2026-11-04T00:00:00.000Z');
  });
  it('todo resultado valida contra CategoryTrendCalcSchema', () => {
    const r = [...calculateTrends(listing([1, 2, 3, 4, 5]), OPTS), ...calculateTrends([], OPTS)];
    for (const x of r) expect(CategoryTrendCalcSchema.safeParse(x).success).toBe(true);
  });
  it('el esquema exige slope y series juntos solo con tendencia', () => {
    const base = { categoryId: 'CAT-1', qualifiedCount: 4, uploadsNeeded: 0 };
    const series = calculateTrends(listing([1, 2, 3, 4]), OPTS)[0].series;
    const ok = (v: object): boolean => CategoryTrendCalcSchema.safeParse({ ...base, ...v }).success;
    expect(ok({ status: 'improving', slope: 1, series })).toBe(true);
    expect(ok({ status: 'improving' })).toBe(false);
    expect(ok({ status: 'improving', slope: 1 })).toBe(false);
    expect(ok({ status: 'improving', series })).toBe(false);
    expect(ok({ status: 'insufficient_data' })).toBe(true);
    expect(ok({ status: 'insufficient_data', slope: 1 })).toBe(false);
    expect(ok({ status: 'insufficient_data', series })).toBe(false);
    expect(ok({ status: 'insufficient_data', slope: 1, series })).toBe(false);
  });
});

describe('calculateTrends — silencio de consola', () => {
  let spies: jest.SpyInstance[];
  beforeEach(() => {
    spies = [
      jest.spyOn(console, 'log').mockImplementation(() => undefined),
      jest.spyOn(console, 'info').mockImplementation(() => undefined),
      jest.spyOn(console, 'warn').mockImplementation(() => undefined),
      jest.spyOn(console, 'error').mockImplementation(() => undefined),
      jest.spyOn(console, 'debug').mockImplementation(() => undefined),
      jest.spyOn(process.stdout, 'write').mockImplementation(() => true),
    ];
  });
  afterEach(() => {
    spies.forEach((s) => s.mockRestore());
  });

  it('no escribe en consola ni stdout, con tendencia ni con insufficient_data', () => {
    calculateTrends(listing([1, 2, 3, 4]), OPTS);
    calculateTrends([], OPTS);
    for (const s of spies) expect(s).not.toHaveBeenCalled();
  });
});
