import { addDays, dayKeyFor, startOfDayInZone } from './dayKey';

export const TOKEN_LENGTH = 6;
// No 0/O or 1/I, so a token read aloud can't be mistyped.
export const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const HANGOUT_TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000;
export const REMINDER_INTERVAL_MS = 2 * 60 * 60 * 1000;

export function makeToken(): string {
  const bytes = new Uint32Array(TOKEN_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => TOKEN_ALPHABET[b % TOKEN_ALPHABET.length]).join('');
}

export const cleanToken = (raw: string) => raw.trim().toUpperCase();

/** 24 hours for a hangout; midnight at the end of the last day for a tour. */
export function tokenExpiry(kind: 'hangout' | 'tour', start: Date, days: number, timeZone: string): Date {
  if (kind === 'hangout') return new Date(start.getTime() + HANGOUT_TOKEN_LIFETIME_MS);
  return startOfDayInZone(addDays(dayKeyFor(start, timeZone), days), timeZone);
}
