import { describe, expect, it } from 'vitest';
import { netBalances, settle, shareOf } from './settlement';

const t = (taka: number) => Math.round(taka * 100);

describe('settle', () => {
  it('matches the worked example in the handoff (§6)', () => {
    const members = ['A', 'B', 'C', 'D'];
    const all = members;
    const result = settle(
      [
        { amountCents: t(600), paidByID: 'A', splitAmongIDs: all },
        { amountCents: t(1000), paidByID: 'B', splitAmongIDs: all },
        { amountCents: t(200), paidByID: 'C', splitAmongIDs: all },
      ],
      members,
    );
    expect(result).toEqual([
      { fromID: 'D', toID: 'B', amountCents: t(450) },
      { fromID: 'C', toID: 'A', amountCents: t(150) },
      { fromID: 'C', toID: 'B', amountCents: t(100) },
    ]);
  });

  it('charges only the people in a partial split', () => {
    const result = settle([{ amountCents: t(300), paidByID: 'A', splitAmongIDs: ['A', 'B', 'C'] }], ['A', 'B', 'C', 'D']);
    expect(result).toEqual([
      { fromID: 'B', toID: 'A', amountCents: t(100) },
      { fromID: 'C', toID: 'A', amountCents: t(100) },
    ]);
  });

  it('puts leftover paisa on the first ids in sorted order', () => {
    const b = netBalances([{ amountCents: 100, paidByID: 'C', splitAmongIDs: ['C', 'B', 'A'] }], ['A', 'B', 'C']);
    expect(b.get('A')).toBe(-34);
    expect(b.get('B')).toBe(-33);
    expect(b.get('C')).toBe(67);
    // Balances always add up to zero.
    expect([...b.values()].reduce((s, v) => s + v, 0)).toBe(0);
  });

  it('prefers an exact match over the greedy pass', () => {
    const result = settle(
      [
        { amountCents: t(300), paidByID: 'A', splitAmongIDs: ['A', 'B'] },
        { amountCents: t(500), paidByID: 'C', splitAmongIDs: ['C', 'D'] },
      ],
      ['A', 'B', 'C', 'D'],
    );
    expect(result).toEqual([
      { fromID: 'B', toID: 'A', amountCents: t(150) },
      { fromID: 'D', toID: 'C', amountCents: t(250) },
    ]);
  });

  it('needs no payments when everyone paid their own share', () => {
    expect(settle([{ amountCents: t(100), paidByID: 'A', splitAmongIDs: ['A'] }], ['A', 'B'])).toEqual([]);
    expect(settle([], ['A', 'B'])).toEqual([]);
  });

  it('never needs more than n - 1 payments', () => {
    const members = ['a', 'b', 'c', 'd', 'e', 'f'];
    const expenses = members.map((m, i) => ({ amountCents: (i + 1) * 1237, paidByID: m, splitAmongIDs: members }));
    expect(settle(expenses, members).length).toBeLessThanOrEqual(members.length - 1);
  });
});

describe('shareOf', () => {
  it('uses the same leftover rule as settling', () => {
    const e = { amountCents: 100, paidByID: 'C', splitAmongIDs: ['C', 'B', 'A'] };
    expect([shareOf(e, 'A'), shareOf(e, 'B'), shareOf(e, 'C'), shareOf(e, 'Z')]).toEqual([34, 33, 33, 0]);
  });
});
