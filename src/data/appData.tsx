import { limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppNotification, Bill, Hangout } from '../lib/types';
import { spendingSummary } from '../lib/stats';
import { loadAllExpenses, postRemindersIfDue, publishStats } from './actions';
import { useAuth } from './auth';
import { toBill, toHangout, toNotification } from './convert';
import { friendlyError } from './errors';
import { billsCol, hangoutsCol, notificationsCol } from './paths';

interface AppData {
  hangouts: Hangout[];
  bills: Bill[];
  notifications: AppNotification[];
  loaded: boolean;
  error: string | null;
}

const DataContext = createContext<AppData>({ hangouts: [], bills: [], notifications: [], loaded: false, error: null });

export const useAppData = () => useContext(DataContext);

/** Live lists of every hangout and bill the user is part of (one listener each). */
export function DataProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const [hangouts, setHangouts] = useState<Hangout[] | null>(null);
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onErr = (e: unknown) => setError(friendlyError(e));
    // Sorted here rather than with orderBy so the queries need no composite index.
    const offH = onSnapshot(
      query(hangoutsCol(), where('memberIDs', 'array-contains', uid)),
      (s) => setHangouts(s.docs.map(toHangout).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())),
      onErr,
    );
    const offB = onSnapshot(
      query(billsCol(), where('hangoutMemberIDs', 'array-contains', uid)),
      (s) => setBills(s.docs.map(toBill).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())),
      onErr,
    );
    const offN = onSnapshot(
      query(notificationsCol(uid), orderBy('createdAt', 'desc'), limit(50)),
      (s) => setNotifications(s.docs.map(toNotification)),
      () => undefined,
    );
    return () => {
      offN();
      offH();
      offB();
    };
  }, [uid]);

  // Reminders for ended hangouts with unpaid bills: checked on open and every minute,
  // like the iOS app. The Cloud Function does the same on a schedule when deployed.
  useEffect(() => {
    if (!hangouts || !bills) return;
    const tick = () => {
      for (const h of hangouts) if (h.status === 'ended') void postRemindersIfDue(h, bills).catch(() => undefined);
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [hangouts, bills]);

  // Refresh the shareable spending summary once per session, so member profiles
  // aren't stale until the user opens the side menu.
  const { profile } = useAuth();
  const published = useRef(false);
  useEffect(() => {
    if (published.current || !hangouts || !bills || !profile) return;
    published.current = true;
    void loadAllExpenses(hangouts)
      .then((expenses) => publishStats(profile, spendingSummary(uid, hangouts, expenses, bills)))
      .catch(() => undefined);
  }, [hangouts, bills, profile, uid]);

  const value = useMemo(
    () => ({ hangouts: hangouts ?? [], bills: bills ?? [], notifications, loaded: hangouts !== null && bills !== null, error }),
    [hangouts, bills, notifications, error],
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
