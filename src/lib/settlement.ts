// Settlement maths, ported 1:1 from the iOS SettlementCalculator (see docs/HANDOFF.md §6).
// Every device must produce identical bills, so keep the ordering rules exactly.
// All amounts here are whole paisa.

export interface ExpenseLike {
  amountCents: number;
  paidByID: string;
  /** Who shares it equally (payer included if they share). Empty = every member. */
  splitAmongIDs: string[];
}

export interface Transfer {
  fromID: string;
  toID: string;
  amountCents: number;
}

const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Net balance per member in paisa. Positive = should receive. */
export function netBalances(expenses: ExpenseLike[], memberIDs: string[]): Map<string, number> {
  const balances = new Map<string, number>();
  for (const uid of memberIDs) balances.set(uid, 0);

  for (const e of expenses) {
    // Sorted so the leftover paisa land on the same people on every device.
    const people = [...(e.splitAmongIDs.length ? e.splitAmongIDs : memberIDs)].sort(byId);
    if (people.length === 0) continue;

    const cents = Math.round(e.amountCents);
    balances.set(e.paidByID, (balances.get(e.paidByID) ?? 0) + cents);

    const base = Math.floor(cents / people.length);
    const leftover = cents % people.length;
    people.forEach((uid, i) => {
      const share = base + (i < leftover ? 1 : 0);
      balances.set(uid, (balances.get(uid) ?? 0) - share);
    });
  }
  return balances;
}

/** The fewest payments that bring every balance back to zero (at most n - 1). */
export function transfersFromBalances(balances: Map<string, number>): Transfer[] {
  type Entry = { id: string; cents: number };
  let creditors: Entry[] = [];
  let debtors: Entry[] = [];
  for (const [id, c] of balances) {
    if (c > 0) creditors.push({ id, cents: c });
    else if (c < 0) debtors.push({ id, cents: -c });
  }
  const result: Transfer[] = [];

  // 1. A debtor who owes exactly what a creditor is owed settles in one payment.
  //    Ties go to the creditor with the smallest id.
  for (const d of debtors) {
    let match: Entry | undefined;
    for (const c of creditors) {
      if (c.cents === d.cents && c.cents > 0 && (!match || c.id < match.id)) match = c;
    }
    if (match) {
      result.push({ fromID: d.id, toID: match.id, amountCents: d.cents });
      match.cents = 0;
      d.cents = 0;
    }
  }
  creditors = creditors.filter((c) => c.cents > 0);
  debtors = debtors.filter((d) => d.cents > 0);

  // 2. Biggest debtor pays biggest creditor until everyone is even.
  //    Ties on amount are broken by smaller id first.
  const biggestFirst = (a: Entry, b: Entry) => (a.cents === b.cents ? byId(a.id, b.id) : b.cents - a.cents);
  while (creditors.length && debtors.length) {
    creditors.sort(biggestFirst);
    debtors.sort(biggestFirst);
    const pay = Math.min(creditors[0].cents, debtors[0].cents);
    result.push({ fromID: debtors[0].id, toID: creditors[0].id, amountCents: pay });
    creditors[0].cents -= pay;
    debtors[0].cents -= pay;
    creditors = creditors.filter((c) => c.cents > 0);
    debtors = debtors.filter((d) => d.cents > 0);
  }
  return result;
}

export const settle = (expenses: ExpenseLike[], memberIDs: string[]): Transfer[] =>
  transfersFromBalances(netBalances(expenses, memberIDs));

/** One person's share of a cost, in paisa (same leftover rule as settling). */
export function shareOf(e: ExpenseLike, uid: string, memberIDs: string[] = []): number {
  const people = [...(e.splitAmongIDs.length ? e.splitAmongIDs : memberIDs)].sort(byId);
  const i = people.indexOf(uid);
  if (i < 0) return 0;
  const base = Math.floor(e.amountCents / people.length);
  return base + (i < e.amountCents % people.length ? 1 : 0);
}
