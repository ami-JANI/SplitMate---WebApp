import { Timestamp, type DocumentData, type DocumentSnapshot, type QueryDocumentSnapshot } from 'firebase/firestore';
import type { AppUser, Bill, Expense, Hangout, HangoutNotice, PublicStats } from '../lib/types';

type Snap = QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>;

/** Timestamps written with serverTimestamp() are null until the server confirms. */
const date = (v: unknown): Date => (v instanceof Timestamp ? v.toDate() : v instanceof Date ? v : new Date());
const optDate = (v: unknown): Date | undefined => (v == null ? undefined : date(v));

export function toUser(s: Snap): AppUser {
  const d = s.data() ?? {};
  return {
    id: s.id,
    name: d.name ?? '',
    username: d.username ?? '',
    friendIDs: d.friendIDs ?? [],
    showsExpenses: d.showsExpenses ?? true,
    avatar: d.avatar ?? undefined,
    createdAt: date(d.createdAt),
  };
}

export function toHangout(s: Snap): Hangout {
  const d = s.data() ?? {};
  return {
    id: s.id,
    title: d.title ?? '',
    kind: d.kind === 'tour' ? 'tour' : 'hangout',
    status: d.status === 'ended' ? 'ended' : 'active',
    creatorID: d.creatorID ?? '',
    memberIDs: d.memberIDs ?? [],
    memberNames: d.memberNames ?? {},
    memberAvatars: d.memberAvatars ?? {},
    token: d.token ?? '',
    createdAt: date(d.createdAt),
    tokenExpiresAt: date(d.tokenExpiresAt),
    days: d.days ?? 1,
    timeZone: d.timeZone ?? 'UTC',
    settledDays: d.settledDays ?? [],
    totalSpentCents: d.totalSpentCents ?? 0,
    endedAt: optDate(d.endedAt),
    lastReminderAt: optDate(d.lastReminderAt),
  };
}

export function toExpense(s: Snap): Expense {
  const d = s.data() ?? {};
  return {
    id: s.id,
    hangoutID: d.hangoutID ?? '',
    title: d.title ?? '',
    amountCents: d.amountCents ?? 0,
    paidByID: d.paidByID ?? '',
    paidByName: d.paidByName ?? 'Someone',
    splitAmongIDs: d.splitAmongIDs ?? [],
    dayKey: d.dayKey ?? '',
    createdAt: date(d.createdAt),
  };
}

export function toNotice(s: Snap): HangoutNotice {
  const d = s.data() ?? {};
  return { id: s.id, message: d.message ?? '', forUserID: d.forUserID ?? undefined, createdAt: date(d.createdAt) };
}

export function toBill(s: Snap): Bill {
  const d = s.data() ?? {};
  return {
    id: s.id,
    hangoutID: d.hangoutID ?? '',
    hangoutTitle: d.hangoutTitle ?? '',
    hangoutMemberIDs: d.hangoutMemberIDs ?? [],
    fromID: d.fromID ?? '',
    fromName: d.fromName ?? 'Someone',
    fromAvatar: d.fromAvatar ?? undefined,
    toID: d.toID ?? '',
    toName: d.toName ?? 'Someone',
    toAvatar: d.toAvatar ?? undefined,
    amountCents: d.amountCents ?? 0,
    dayKey: d.dayKey ?? undefined,
    status: d.status === 'inProgress' || d.status === 'delivered' ? d.status : 'due',
    createdAt: date(d.createdAt),
    updatedAt: date(d.updatedAt),
  };
}

export function toPublicStats(s: Snap): PublicStats | null {
  if (!s.exists()) return null;
  const d = s.data() ?? {};
  return {
    visible: d.visible === true,
    totalSpentCents: d.totalSpentCents ?? 0,
    hangoutCount: d.hangoutCount ?? 0,
    busiestWeekday: d.busiestWeekday ?? undefined,
    busiestMonth: d.busiestMonth ?? undefined,
    updatedAt: optDate(d.updatedAt),
  };
}
