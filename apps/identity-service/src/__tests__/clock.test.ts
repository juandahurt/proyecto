import { currentYearMonth, firstDayOfNextMonth } from '../service/clock';

describe('currentYearMonth', () => {
  it('devuelve YYYY-MM del mes actual en UTC', () => {
    expect(currentYearMonth(new Date('2026-11-15T00:00:00Z'))).toBe('2026-11');
  });
  it('devuelve el mes correcto para enero', () => {
    expect(currentYearMonth(new Date('2026-01-01T12:00:00Z'))).toBe('2026-01');
  });
  it('devuelve el mes correcto para diciembre', () => {
    expect(currentYearMonth(new Date('2026-12-31T23:59:59Z'))).toBe('2026-12');
  });
  it('usa new Date() por defecto (formato YYYY-MM)', () => {
    expect(currentYearMonth()).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('firstDayOfNextMonth', () => {
  it('devuelve primer dia del mes siguiente para noviembre 2026', () => {
    expect(firstDayOfNextMonth(new Date('2026-11-15T00:00:00Z'))).toBe('2026-12-01');
  });
  it('rollover diciembre enero (cambio de anio)', () => {
    expect(firstDayOfNextMonth(new Date('2026-12-15T00:00:00Z'))).toBe('2027-01-01');
  });
  it('rollover enero febrero', () => {
    expect(firstDayOfNextMonth(new Date('2024-01-15T00:00:00Z'))).toBe('2024-02-01');
  });
  it('rollover febrero marzo en anio bisiesto (2024)', () => {
    expect(firstDayOfNextMonth(new Date('2024-02-29T00:00:00Z'))).toBe('2024-03-01');
  });
  it('rollover febrero marzo en anio no bisiesto (2026)', () => {
    expect(firstDayOfNextMonth(new Date('2026-02-28T00:00:00Z'))).toBe('2026-03-01');
  });
  it('usa new Date() por defecto (formato YYYY-MM-DD)', () => {
    expect(firstDayOfNextMonth()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
