import { describe, expect, it } from 'vitest';
import { addDays, dayHeader, dayKeyFor, startOfDayInZone } from './dayKey';

describe('dayKey', () => {
  it('uses the hangout zone, not UTC', () => {
    // 20:30 UTC on 11 Nov is already 12 Nov in Dhaka (UTC+6).
    const at = new Date('2026-11-11T20:30:00Z');
    expect(dayKeyFor(at, 'Asia/Dhaka')).toBe('2026-11-12');
    expect(dayKeyFor(at, 'UTC')).toBe('2026-11-11');
  });

  it('finds midnight in a zone', () => {
    expect(startOfDayInZone('2026-11-12', 'Asia/Dhaka').toISOString()).toBe('2026-11-11T18:00:00.000Z');
    expect(startOfDayInZone('2026-07-01', 'Europe/London').toISOString()).toBe('2026-06-30T23:00:00.000Z');
  });

  it('adds days across months', () => {
    expect(addDays('2026-11-29', 3)).toBe('2026-12-02');
  });

  it('formats a day header', () => {
    expect(dayHeader('2026-11-12')).toBe('THU, 12 NOV');
  });
});
