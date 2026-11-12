import {
  arrayRemove,
  arrayUnion,
  deleteField,
  doc,
  documentId,
  getDoc,
  getDocs,
  getDocsFromServer,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { localTimeZone, todayKey } from '../lib/dayKey';
import { formatTaka } from '../lib/money';
import { settle } from '../lib/settlement';
import type { SpendingSummary } from '../lib/stats';
import { cleanToken, makeToken, REMINDER_INTERVAL_MS, TOKEN_LENGTH, tokenExpiry } from '../lib/token';
import { billStatusTitle, isPaid, memberAvatar, memberName, type AppUser, type Bill, type Expense, type Hangout, type HangoutKind } from '../lib/types';
import { expenseProblem, hangoutProblem } from '../lib/validator';
import { toExpense, toHangout, toUser } from './convert';
import { friendlyError } from './errors';
import {
  billDoc,
  billsCol,
  expensesCol,
  hangoutDoc,
  hangoutsCol,
  noticesCol,
  publicStatsDoc,
  tokenDoc,
  userDoc,
  usersCol,
} from './paths';

// ---------------------------------------------------------------- Hangouts

/** Creates a hangout or tour with a unique join token. Returns the new id, or an error message. */
export async function createHangout(input: {
  title: string;
  kind: HangoutKind;
  days: number;
  creator: AppUser;
  friends: AppUser[];
}): Promise<{ id?: string; error?: string }> {
  const title = input.title.trim();
  const days = input.kind === 'tour' ? input.days : 1;
  const problem = hangoutProblem(title, input.kind, days);
  if (problem) return { error: problem };

  const { creator, friends } = input;
  const names: Record<string, string> = { [creator.id]: creator.name };
  const avatars: Record<string, string> = {};
  if (creator.avatar) avatars[creator.id] = creator.avatar;
  for (const f of friends) {
    names[f.id] = f.name;
    if (f.avatar) avatars[f.id] = f.avatar;
  }
  const memberIDs = [creator.id, ...friends.map((f) => f.id).filter((id) => id !== creator.id)];
  const timeZone = localTimeZone();
  const now = new Date();
  const expiresAt = Timestamp.fromDate(tokenExpiry(input.kind, now, days, timeZone));
  const ref = doc(hangoutsCol());

  // Token docs can't be overwritten, so check for a collision inside a transaction and retry.
  for (let attempt = 0; attempt < 6; attempt++) {
    const token = makeToken();
    try {
      const created = await runTransaction(db, async (tx) => {
        const existing = await tx.get(tokenDoc(token));
        if (existing.exists()) return false;
        tx.set(ref, {
          title,
          kind: input.kind,
          status: 'active',
          creatorID: creator.id,
          memberIDs,
          memberNames: names,
          memberAvatars: avatars,
          token,
          createdAt: Timestamp.fromDate(now),
          tokenExpiresAt: expiresAt,
          days,
          timeZone,
          settledDays: [],
          totalSpentCents: 0,
        });
        tx.set(tokenDoc(token), { hangoutID: ref.id, creatorID: creator.id, expiresAt });
        return true;
      });
      if (created) return { id: ref.id };
    } catch (e) {
      return { error: friendlyError(e) };
    }
  }
  return { error: "Couldn't make a unique token. Try again." };
}

/** Joins with a token. Returns the hangout id, or an error message. */
export async function joinHangout(rawToken: string, me: AppUser, myHangouts: Hangout[]): Promise<{ id?: string; error?: string }> {
  const code = cleanToken(rawToken);
  if (code.length !== TOKEN_LENGTH) return { error: `A token has ${TOKEN_LENGTH} characters` };
  try {
    const snap = await getDoc(tokenDoc(code));
    const data = snap.data();
    if (!snap.exists() || typeof data?.hangoutID !== 'string') return { error: 'No hangout uses that token' };
    const expiresAt: Date = data.expiresAt instanceof Timestamp ? data.expiresAt.toDate() : new Date(0);
    if (new Date() >= expiresAt) {
      return { error: 'This token has expired. Hangout tokens last one day; start a tour for longer trips.' };
    }
    if (myHangouts.some((h) => h.id === data.hangoutID)) return { error: "You're already in this hangout" };
    const changes: Record<string, unknown> = {
      memberIDs: arrayUnion(me.id),
      [`memberNames.${me.id}`]: me.name,
    };
    if (me.avatar) changes[`memberAvatars.${me.id}`] = me.avatar;
    try {
      await updateDoc(hangoutDoc(data.hangoutID), changes);
    } catch {
      return { error: "Couldn't join. The hangout may have ended." };
    }
    return { id: data.hangoutID };
  } catch (e) {
    return { error: friendlyError(e) };
  }
}

/** A member adds someone to an open hangout. They share costs added from now on, not earlier ones. */
export async function addMember(hangout: Hangout, user: AppUser): Promise<string | null> {
  if (hangout.status !== 'active') return 'This hangout has ended';
  if (hangout.memberIDs.includes(user.id)) return null;
  const changes: Record<string, unknown> = {
    memberIDs: arrayUnion(user.id),
    [`memberNames.${user.id}`]: user.name,
  };
  if (user.avatar) changes[`memberAvatars.${user.id}`] = user.avatar;
  try {
    await updateDoc(hangoutDoc(hangout.id), changes);
    return null;
  } catch (e) {
    return friendlyError(e);
  }
}

// ---------------------------------------------------------------- Costs

export async function addExpense(
  hangout: Hangout,
  input: { title: string; amountCents: number | undefined; paidByID: string; splitAmongIDs: string[] },
): Promise<string | null> {
  if (hangout.status === 'ended') return 'This hangout has ended';
  const title = input.title.trim();
  const problem = expenseProblem(title, input.amountCents, input.splitAmongIDs.length);
  if (problem) return problem;
  const today = todayKey(hangout.timeZone);
  if (hangout.settledDays.includes(today)) return "Today's bills are already settled";
  const amountCents = input.amountCents as number;

  // Stored in member order so the list reads naturally; settling sorts by id itself.
  const split = hangout.memberIDs.filter((id) => input.splitAmongIDs.includes(id));
  const batch = writeBatch(db);
  batch.set(doc(expensesCol(hangout.id)), {
    hangoutID: hangout.id,
    title,
    amountCents,
    paidByID: input.paidByID,
    paidByName: memberName(hangout, input.paidByID),
    splitAmongIDs: split,
    dayKey: today,
    createdAt: serverTimestamp(),
  });
  batch.update(hangoutDoc(hangout.id), { totalSpentCents: increment(amountCents) });
  try {
    await batch.commit();
    return null;
  } catch (e) {
    return friendlyError(e);
  }
}

export async function deleteExpense(hangout: Hangout, expense: Expense): Promise<string | null> {
  if (hangout.status === 'ended' || hangout.settledDays.includes(expense.dayKey)) return 'That day is already settled';
  const batch = writeBatch(db);
  batch.delete(doc(expensesCol(hangout.id), expense.id));
  batch.update(hangoutDoc(hangout.id), { totalSpentCents: increment(-expense.amountCents) });
  try {
    await batch.commit();
    return null;
  } catch (e) {
    return friendlyError(e);
  }
}

// ---------------------------------------------------------------- Settling

/**
 * Turns the given days' costs into bills inside one transaction, so two devices
 * can never create the same bills twice. A tour is settled day by day; a hangout
 * all at once.
 */
async function settleDays(hangoutID: string, days: Set<string>, ending: boolean): Promise<void> {
  // Fresh from the server so a cost added on another phone a moment ago is included.
  const expenses = (await getDocsFromServer(expensesCol(hangoutID))).docs.map(toExpense);
  const ref = hangoutDoc(hangoutID);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const fresh = toHangout(snap);
    if (fresh.status !== 'active') return;

    // Skip days another member settled in the meantime.
    const openDays = [...days].filter((d) => !fresh.settledDays.includes(d)).sort();
    const open = expenses.filter((e) => openDays.includes(e.dayKey));
    const groups: { day?: string; expenses: Expense[] }[] =
      fresh.kind === 'tour' ? openDays.map((day) => ({ day, expenses: open.filter((e) => e.dayKey === day) })) : [{ expenses: open }];

    for (const g of groups) {
      for (const t of settle(g.expenses, fresh.memberIDs)) {
        const fromAvatar = memberAvatar(fresh, t.fromID);
        const toAvatar = memberAvatar(fresh, t.toID);
        tx.set(doc(billsCol()), {
          hangoutID: fresh.id,
          hangoutTitle: fresh.title,
          hangoutMemberIDs: fresh.memberIDs,
          fromID: t.fromID,
          fromName: memberName(fresh, t.fromID),
          toID: t.toID,
          toName: memberName(fresh, t.toID),
          amountCents: t.amountCents,
          status: 'due',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          ...(g.day ? { dayKey: g.day } : {}),
          ...(fromAvatar ? { fromAvatar } : {}),
          ...(toAvatar ? { toAvatar } : {}),
        });
      }
    }

    const changes: Record<string, unknown> = {};
    if (openDays.length) changes.settledDays = arrayUnion(...openDays);
    if (ending) {
      changes.status = 'ended';
      changes.endedAt = serverTimestamp();
    }
    if (Object.keys(changes).length) tx.update(ref, changes);
  });
}

/** The creator ends the hangout. Everything not yet settled becomes bills. */
export async function endHangout(hangout: Hangout, uid: string, expenses: Expense[]): Promise<string | null> {
  if (hangout.creatorID !== uid) return 'Only the person who started it can end it';
  if (hangout.status === 'ended') return null;
  try {
    await settleDays(hangout.id, new Set(expenses.map((e) => e.dayKey)), true);
    return null;
  } catch (e) {
    return friendlyError(e);
  }
}

/** A tour closes each day at the day's end. The first member to open it after midnight creates the bills. */
export async function settleFinishedTourDays(hangout: Hangout, expenses: Expense[]): Promise<string | null> {
  if (hangout.kind !== 'tour' || hangout.status !== 'active') return null;
  const today = todayKey(hangout.timeZone);
  const finished = new Set(expenses.map((e) => e.dayKey).filter((d) => d < today && !hangout.settledDays.includes(d)));
  if (!finished.size) return null;
  try {
    await settleDays(hangout.id, finished, false);
    return null;
  } catch (e) {
    return friendlyError(e);
  }
}

// ---------------------------------------------------------------- Bills

export async function markInProgress(bill: Bill, uid: string): Promise<string | null> {
  if (bill.fromID !== uid || bill.status !== 'due') return null;
  return updateBill(bill, 'inProgress');
}

export async function confirmReceived(bill: Bill, uid: string): Promise<string | null> {
  if (bill.toID !== uid || bill.status === 'delivered') return null;
  return updateBill(bill, 'delivered');
}

async function updateBill(bill: Bill, status: Bill['status']) {
  try {
    await updateDoc(billDoc(bill.id), { status, updatedAt: serverTimestamp() });
    if ('vibrate' in navigator) navigator.vibrate?.(12);
    return null;
  } catch (e) {
    return friendlyError(e);
  }
}

/**
 * After a hangout ends, anyone who still owes gets a reminder inside the hangout
 * every two hours. The transaction makes sure only one device posts each round.
 */
export async function postRemindersIfDue(hangout: Hangout, allBills: Bill[]): Promise<void> {
  if (hangout.status !== 'ended') return;
  const unpaid = allBills.filter((b) => b.hangoutID === hangout.id && !isPaid(b.status));
  if (!unpaid.length) return;
  const last = hangout.lastReminderAt ?? hangout.endedAt;
  if (!last || Date.now() - last.getTime() < REMINDER_INTERVAL_MS) return;

  const ref = hangoutDoc(hangout.id);
  await runTransaction(db, async (tx) => {
    const fresh = toHangout(await tx.get(ref));
    const latest = fresh.lastReminderAt ?? fresh.endedAt ?? last;
    if (Date.now() - latest.getTime() < REMINDER_INTERVAL_MS) return; // another member already sent this round
    for (const b of unpaid) {
      tx.set(doc(noticesCol(hangout.id)), {
        message: `Reminder: ${b.fromName} still owes ${b.toName} ${formatTaka(b.amountCents)} (${billStatusTitle[b.status].toLowerCase()}).`,
        forUserID: b.fromID,
        createdAt: serverTimestamp(),
      });
    }
    tx.update(ref, { lastReminderAt: serverTimestamp() });
  });
}

// ---------------------------------------------------------------- Profile

/** Saves a new avatar and copies it into every hangout so members see it straight away. */
export async function updateAvatar(me: AppUser, avatar: string, hangouts: Hangout[]): Promise<string | null> {
  try {
    await updateDoc(userDoc(me.id), { avatar });
    await Promise.all(hangouts.map((h) => updateDoc(hangoutDoc(h.id), { [`memberAvatars.${me.id}`]: avatar }).catch(() => undefined)));
    return null;
  } catch (e) {
    return friendlyError(e);
  }
}

/** Renames the user, including inside active hangouts (bills keep the name they were made with). */
export async function updateName(me: AppUser, name: string, hangouts: Hangout[]): Promise<string | null> {
  const clean = name.trim();
  if (!clean) return 'Name is missing';
  try {
    await updateDoc(userDoc(me.id), { name: clean });
    await Promise.all(
      hangouts
        .filter((h) => h.status === 'active')
        .map((h) => updateDoc(hangoutDoc(h.id), { [`memberNames.${me.id}`]: clean }).catch(() => undefined)),
    );
    return null;
  } catch (e) {
    return friendlyError(e);
  }
}

export async function setShowsExpenses(uid: string, shows: boolean): Promise<string | null> {
  const batch = writeBatch(db);
  batch.update(userDoc(uid), { showsExpenses: shows });
  batch.set(publicStatsDoc(uid), { visible: shows, updatedAt: serverTimestamp() }, { merge: true });
  try {
    await batch.commit();
    return null;
  } catch (e) {
    return friendlyError(e);
  }
}

/** Writes the shareable part of the side-menu summary to publicStats/{uid}. */
export async function publishStats(me: AppUser, s: SpendingSummary) {
  const batch = writeBatch(db);
  batch.set(publicStatsDoc(me.id), {
    visible: me.showsExpenses,
    totalSpentCents: s.totalSpentCents,
    hangoutCount: s.perHangout.length,
    busiestWeekday: s.busiestWeekday ?? deleteField(),
    busiestMonth: s.busiestMonth ?? deleteField(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await batch.commit();
}

/** Every cost in every hangout the user is in (for the side-menu numbers). */
export async function loadAllExpenses(hangouts: Hangout[]): Promise<Expense[]> {
  const lists = await Promise.all(hangouts.map((h) => getDocs(expensesCol(h.id)).then((s) => s.docs.map(toExpense)).catch(() => [])));
  return lists.flat();
}

// ---------------------------------------------------------------- Friends

/** Prefix search on lowercase username, max 20, excluding yourself. */
export async function searchUsers(raw: string, myID: string): Promise<AppUser[]> {
  const q = raw.trim().replace(/^@/, '').toLowerCase();
  if (!q) return [];
  const snap = await getDocs(query(usersCol(), where('username', '>=', q), where('username', '<', q + ''), orderBy('username'), limit(20)));
  return snap.docs.map(toUser).filter((u) => u.id !== myID);
}

/** Loads users by id, 30 per query (Firestore's "in" limit). */
export async function loadUsers(ids: string[]): Promise<AppUser[]> {
  const unique = [...new Set(ids)];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 30) chunks.push(unique.slice(i, i + 30));
  const results = await Promise.all(chunks.map((c) => getDocs(query(usersCol(), where(documentId(), 'in', c)))));
  const byId = new Map(results.flatMap((s) => s.docs.map(toUser)).map((u) => [u.id, u]));
  return unique.map((id) => byId.get(id)).filter((u): u is AppUser => Boolean(u));
}

export async function addFriend(myID: string, friendID: string) {
  await updateDoc(userDoc(myID), { friendIDs: arrayUnion(friendID) });
}

export async function removeFriend(myID: string, friendID: string) {
  await updateDoc(userDoc(myID), { friendIDs: arrayRemove(friendID) });
}
