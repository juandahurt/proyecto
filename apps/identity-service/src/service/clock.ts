export function currentYearMonth(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}

export function firstDayOfNextMonth(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const firstDay = new Date(Date.UTC(year, month + 1, 1));
  return firstDay.toISOString().slice(0, 10);
}
