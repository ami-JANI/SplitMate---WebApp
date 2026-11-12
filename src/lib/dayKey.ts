// A day is a "yyyy-MM-dd" string in the hangout's time zone. Strings sort
// correctly, so "is this day over?" is simply dayKey < todayKey.

export const localTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export function dayKeyFor(date: Date, timeZone: string): string {
  // en-CA formats dates as yyyy-mm-dd.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export const todayKey = (timeZone: string, now = new Date()) => dayKeyFor(now, timeZone);

/** Noon UTC on that calendar day: safe for weekday/month lookups in any zone. */
export function dateFromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** "THU, 12 NOV" */
export function dayHeader(key: string): string {
  const d = dateFromDayKey(key);
  const wd = d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
  const dm = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${wd}, ${dm}`.toUpperCase();
}

/** Offset (ms) of a zone from UTC at a given instant. */
function zoneOffset(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUTC - Math.floor(at.getTime() / 1000) * 1000;
}

/** Midnight at the start of the given day key, in the zone, as an instant. */
export function startOfDayInZone(key: string, timeZone: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  // Two passes handle a DST change near midnight.
  let t = guess - zoneOffset(new Date(guess), timeZone);
  t = guess - zoneOffset(new Date(t), timeZone);
  return new Date(t);
}

/** Adds whole days to a day key. */
export function addDays(key: string, n: number): string {
  const d = dateFromDayKey(key);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
