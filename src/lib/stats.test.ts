import { describe, expect, it } from 'vitest';
import { spendingSummary } from './stats';
import type { Bill, Expense, Hangout } from './types';

const h = { id: 'h1', title: 'Friday dinner' } as Hangout;
const exp = (amountCents: number, dayKey: string, split: string[]): Expense => ({
  id: Math.random().toString(),
  hangoutID: 'h1',
  title: 'x',
  amountCents,
  paidByID: 'a',
  paidByName: 'A',
  splitAmongIDs: split,
  dayKey,
  createdAt: new Date(),
});
const bill = (fromID: string, toID: string, amountCents: number, status: Bill['status']): Bill => ({
  id: Math.random().toString(),
  hangoutID: 'h1',
  hangoutTitle: 'Friday dinner',
  hangoutMemberIDs: ['a', 'b', 'c'],
  fromID,
  fromName: fromID.toUpperCase(),
  toID,
  toName: toID.toUpperCase(),
  amountCents,
  status,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('spendingSummary', () => {
  it('counts only my share and finds busiest day and month', () => {
    const s = spendingSummary(
      'a',
      [h],
      [exp(40000, '2026-11-13', ['a', 'b']), exp(9000, '2026-10-01', ['a', 'b', 'c']), exp(5000, '2026-11-13', ['b'])],
      [bill('a', 'b', 300, 'due'), bill('a', 'b', 200, 'inProgress'), bill('c', 'a', 100, 'delivered')],
    );
    expect(s.totalSpentCents).toBe(23000);
    expect(s.busiestWeekday).toBe('Friday');
    expect(s.busiestMonth).toBe('November');
    expect(s.iOwe).toEqual([{ id: 'b', name: 'B', amount: 500, avatar: undefined }]);
    expect(s.owedToMe).toEqual([]);
    expect(s.topPartner?.id).toBe('b');
    expect(s.perHangout).toEqual([{ id: 'h1', name: 'Friday dinner', amount: 23000 }]);
  });
});
