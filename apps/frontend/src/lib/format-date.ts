const SHORT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const LONG_NO_YEAR = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'long',
  day: 'numeric',
});

/** `Sep 24, 2026` en UTC y en inglés, para que no dependa de la zona de quien lo ve. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : SHORT.format(d);
}

/** `October 1` en UTC y en inglés a partir de `YYYY-MM-DD`; null si no es una fecha válida. */
export function formatResetDate(ymd: string | null): string | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const d = new Date(`${ymd}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : LONG_NO_YEAR.format(d);
}
