import { formatDate, formatResetDate } from '../lib/format-date';

describe('format-date (UTC, sin depender de TZ)', () => {
  it.each([
    ['2026-09-24T00:00:30.000Z', 'Sep 24, 2026'],
    ['2026-09-24T23:59:30.000Z', 'Sep 24, 2026'],
    ['2026-01-01T00:00:30.000Z', 'Jan 1, 2026'],
  ])('formatDate(%s) = %s', (iso, text) => {
    expect(formatDate(iso)).toBe(text);
  });

  it('una fecha inválida da cadena vacía', () => {
    expect(formatDate('ayer')).toBe('');
  });

  it.each([
    ['2026-10-01', 'October 1'],
    ['2026-11-01', 'November 1'],
    ['2026-12-31', 'December 31'],
  ])('formatResetDate(%s) = %s', (ymd, text) => {
    expect(formatResetDate(ymd)).toBe(text);
  });

  it.each([null, '', '2026-10', '2026-13-45', 'hoy'])('formatResetDate(%j) = null', (v) => {
    expect(formatResetDate(v)).toBeNull();
  });
});
