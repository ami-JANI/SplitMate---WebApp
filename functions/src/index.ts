// SplitMate scheduled jobs (docs/HANDOFF.md §11). They do server-side what the app
// also does while someone has it open, so nothing waits for a member to visit:
//   - settleTourDays: turns each finished tour day's costs into bills
//   - sendReminders:  posts a reminder round every 2 hours for unpaid bills
// Both use the same transaction checks as the app, so app and server never double up.
// Deploying functions needs the Blaze (pay-as-you-go) plan; the app works without them.

import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { todayKey } from './shared/dayKey.js';
import { settle } from './shared/settlement.js';

initializeApp();
const db = getFirestore();

const REMINDER_INTERVAL_MS = 2 * 60 * 60 * 1000;
const REGION = 'asia-south1';

const name = (h: DocumentData, uid: string) => (h.memberNames?.[uid] as string | undefined) ?? 'Someone';
const taka = (cents: number) => `৳${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(cents / 100)}`;
const statusTitle: Record<string, string> = { due: 'due', inProgress: 'in progress', delivered: 'delivered' };

export const settleTourDays = onSchedule({ schedule: 'every 15 minutes', region: REGION, timeoutSeconds: 300 }, async () => {
  const tours = await db.collection('hangouts').where('kind', '==', 'tour').where('status', '==', 'active').get();
  for (const tour of tours.docs) {
    try {
      await settleFinishedDays(tour.id);
    } catch (e) {
      logger.error('settle failed', { hangoutID: tour.id, error: String(e) });
    }
  }
});

async function settleFinishedDays(hangoutID: string) {
  const ref = db.collection('hangouts').doc(hangoutID);
  const expenses = (await ref.collection('expenses').get()).docs.map((d) => d.data());
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const h = snap.data();
    if (!h || h.status !== 'active' || h.kind !== 'tour') return;
    const today = todayKey(h.timeZone ?? 'UTC');
    const settled: string[] = h.settledDays ?? [];
    const days = [...new Set(expenses.map((e) => e.dayKey as string))].filter((d) => d < today && !settled.includes(d)).sort();
    if (!days.length) return;

    for (const day of days) {
      const dayExpenses = expenses
        .filter((e) => e.dayKey === day)
        .map((e) => ({ amountCents: e.amountCents as number, paidByID: e.paidByID as string, splitAmongIDs: (e.splitAmongIDs as string[]) ?? [] }));
      for (const t of settle(dayExpenses, h.memberIDs)) {
        const fromAvatar = h.memberAvatars?.[t.fromID];
        const toAvatar = h.memberAvatars?.[t.toID];
        tx.create(db.collection('bills').doc(), {
          hangoutID,
          hangoutTitle: h.title,
          hangoutMemberIDs: h.memberIDs,
          fromID: t.fromID,
          fromName: name(h, t.fromID),
          toID: t.toID,
          toName: name(h, t.toID),
          amountCents: t.amountCents,
          dayKey: day,
          status: 'due',
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          ...(fromAvatar ? { fromAvatar } : {}),
          ...(toAvatar ? { toAvatar } : {}),
        });
      }
    }
    tx.update(ref, { settledDays: FieldValue.arrayUnion(...days) });
    logger.info('settled tour days', { hangoutID, days });
  });
}

export const sendReminders = onSchedule({ schedule: 'every 15 minutes', region: REGION, timeoutSeconds: 300 }, async () => {
  const cutoff = Timestamp.fromMillis(Date.now() - REMINDER_INTERVAL_MS);
  const unpaid = await db.collection('bills').where('status', 'in', ['due', 'inProgress']).get();
  const byHangout = new Map<string, DocumentData[]>();
  for (const b of unpaid.docs) {
    const list = byHangout.get(b.data().hangoutID) ?? [];
    list.push(b.data());
    byHangout.set(b.data().hangoutID, list);
  }

  for (const [hangoutID, bills] of byHangout) {
    const ref = db.collection('hangouts').doc(hangoutID);
    try {
      await db.runTransaction(async (tx) => {
        const h = (await tx.get(ref)).data();
        if (!h || h.status !== 'ended') return;
        const last: Timestamp | undefined = h.lastReminderAt ?? h.endedAt;
        if (!last || last.toMillis() > cutoff.toMillis()) return; // round already sent
        for (const b of bills) {
          tx.create(ref.collection('notices').doc(), {
            message: `Reminder: ${b.fromName} still owes ${b.toName} ${taka(b.amountCents)} (${statusTitle[b.status] ?? b.status}).`,
            forUserID: b.fromID,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
        tx.update(ref, { lastReminderAt: FieldValue.serverTimestamp() });
      });
    } catch (e) {
      logger.error('reminder failed', { hangoutID, error: String(e) });
    }
  }
});
