import { describe, expect, it } from 'vitest';
import { makeToken, TOKEN_ALPHABET, tokenExpiry } from './token';

describe('tokens', () => {
  it('uses 6 unambiguous characters', () => {
    for (let i = 0; i < 50; i++) {
      const t = makeToken();
      expect(t).toHaveLength(6);
      for (const c of t) expect(TOKEN_ALPHABET).toContain(c);
    }
  });
  it('hangout token lasts 24 hours', () => {
    const start = new Date('2026-11-12T14:15:00Z');
    expect(tokenExpiry('hangout', start, 1, 'Asia/Dhaka').toISOString()).toBe('2026-11-13T14:15:00.000Z');
  });
  it('3-day tour token lasts until midnight after day 3', () => {
    const start = new Date('2026-11-12T14:15:00Z'); // 8:15 PM in Dhaka
    expect(tokenExpiry('tour', start, 3, 'Asia/Dhaka').toISOString()).toBe('2026-11-14T18:00:00.000Z');
  });
});
