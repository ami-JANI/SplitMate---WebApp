import { dateFromDayKey } from './dayKey';
import { shareOf } from './settlement';
import { isPaid, type Bill, type Expense, type Hangout } from './types';

/** A person (or hangout) and an amount, e.g. "Bashir, ৳450". */
export interface PersonAmount {
  id: string;
  name: string;
  amount: number;
  avatar?: string;
}

export interface SpendingSummary {
  iOwe: PersonAmount[];
  owedToMe: PersonAmount[];
  totalSpentCents: number;
  /** id = hangout id, name = hangout title, amount = paisa */
  perHangout: PersonAmount[];
  busiestWeekday?: string;
  busiestMonth?: string;
  /** amount = number of bills together */
  topPartner?: PersonAmount;
}

const biggestFirst = (a: PersonAmount, b: PersonAmount) => b.amount - a.amount;

/** Unpaid bills grouped by the other person, biggest first. */
export function openBalances(uid: string, bills: Bill[]) {
  const owe = new Map<string, PersonAmount>();
  const owed = new Map<string, PersonAmount>();
  for (const b of bills) {
    if (isPaid(b.status)) continue;
    if (b.fromID === uid) {
      const prev = owe.get(b.toID);
      owe.set(b.toID, { id: b.toID, name: b.toName, avatar: b.toAvatar, amount: (prev?.amount ?? 0) + b.amountCents });
    } else if (b.toID === uid) {
      const prev = owed.get(b.fromID);
      owed.set(b.fromID, { id: b.fromID, name: b.fromName, avatar: b.fromAvatar, amount: (prev?.amount ?? 0) + b.amountCents });
    }
  }
  return { iOwe: [...owe.values()].sort(biggestFirst), owedToMe: [...owed.values()].sort(biggestFirst) };
}

export function openTotals(uid: string, bills: Bill[]) {
  let owe = 0;
  let owed = 0;
  for (const b of bills) {
    if (isPaid(b.status)) continue;
    if (b.fromID === uid) owe += b.amountCents;
    else if (b.toID === uid) owed += b.amountCents;
  }
  return { owe, owed };
}

/** The person the user has the most bills with, paid or not. */
export function topPartner(uid: string, bills: Bill[]): PersonAmount | undefined {
  const counts = new Map<string, PersonAmount>();
  for (const b of bills) {
    if (b.fromID !== uid && b.toID !== uid) continue;
    const [id, name, avatar] = b.fromID === uid ? [b.toID, b.toName, b.toAvatar] : [b.fromID, b.fromName, b.fromAvatar];
    counts.set(id, { id, name, avatar, amount: (counts.get(id)?.amount ?? 0) + 1 });
  }
  let best: PersonAmount | undefined;
  for (const p of counts.values()) if (!best || p.amount > best.amount) best = p;
  return best;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function maxKey(m: Map<number, number>): number | undefined {
  let best: number | undefined;
  for (const [k, v] of m) if (best === undefined || v > (m.get(best) ?? 0)) best = k;
  return best;
}

/** "Spend" means the user's own share of each cost, not what they paid for others. */
export function spendingSummary(uid: string, hangouts: Hangout[], expenses: Expense[], bills: Bill[]): SpendingSummary {
  const { iOwe, owedToMe } = openBalances(uid, bills);
  const perHangout = new Map<string, number>();
  const perWeekday = new Map<number, number>();
  const perMonth = new Map<number, number>();
  let total = 0;
  for (const e of expenses) {
    const share = shareOf(e, uid);
    if (share <= 0) continue;
    total += share;
    perHangout.set(e.hangoutID, (perHangout.get(e.hangoutID) ?? 0) + share);
    const d = dateFromDayKey(e.dayKey);
    perWeekday.set(d.getUTCDay(), (perWeekday.get(d.getUTCDay()) ?? 0) + share);
    perMonth.set(d.getUTCMonth(), (perMonth.get(d.getUTCMonth()) ?? 0) + share);
  }
  const wd = maxKey(perWeekday);
  const mo = maxKey(perMonth);
  return {
    iOwe,
    owedToMe,
    totalSpentCents: total,
    perHangout: hangouts
      .filter((h) => perHangout.has(h.id))
      .map((h) => ({ id: h.id, name: h.title, amount: perHangout.get(h.id) ?? 0 }))
      .sort(biggestFirst),
    busiestWeekday: wd === undefined ? undefined : WEEKDAYS[wd],
    busiestMonth: mo === undefined ? undefined : MONTHS[mo],
    topPartner: topPartner(uid, bills),
  };
}
