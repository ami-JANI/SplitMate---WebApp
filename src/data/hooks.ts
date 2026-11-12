import { limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import type { AppUser, Expense, HangoutNotice, PublicStats } from '../lib/types';
import { loadUsers } from './actions';
import { toExpense, toNotice, toPublicStats, toUser } from './convert';
import { friendlyError } from './errors';
import { expensesCol, noticesCol, publicStatsDoc, userDoc } from './paths';

/** Costs (newest first) and the latest 20 notices of one hangout. */
export function useHangoutDetail(hangoutID: string) {
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [notices, setNotices] = useState<HangoutNotice[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setExpenses(null);
    const onErr = (e: unknown) => setError(friendlyError(e));
    const offE = onSnapshot(query(expensesCol(hangoutID), orderBy('createdAt', 'desc')), (s) => setExpenses(s.docs.map(toExpense)), onErr);
    const offN = onSnapshot(query(noticesCol(hangoutID), orderBy('createdAt', 'desc'), limit(20)), (s) => setNotices(s.docs.map(toNotice)), onErr);
    return () => {
      offE();
      offN();
    };
  }, [hangoutID]);

  return { expenses: expenses ?? [], expensesLoaded: expenses !== null, notices, error, setError };
}

/** Someone's public profile, live. */
export function useUser(uid: string | undefined) {
  const [user, setUser] = useState<AppUser | null | undefined>(undefined);
  useEffect(() => {
    if (!uid) return;
    setUser(undefined);
    return onSnapshot(userDoc(uid), (s) => setUser(s.exists() ? toUser(s) : null), () => setUser(null));
  }, [uid]);
  return user;
}

/** Someone's shared spending summary. 'hidden' when the rules refuse the read. */
export function usePublicStats(uid: string | undefined) {
  const [stats, setStats] = useState<PublicStats | null | 'hidden' | undefined>(undefined);
  useEffect(() => {
    if (!uid) return;
    setStats(undefined);
    return onSnapshot(publicStatsDoc(uid), (s) => setStats(toPublicStats(s)), () => setStats('hidden'));
  }, [uid]);
  return stats;
}

/** Loads the user's friends whenever their friend list changes. */
export function useFriends(friendIDs: string[]) {
  const [friends, setFriends] = useState<AppUser[] | null>(null);
  const key = friendIDs.join(',');
  useEffect(() => {
    let live = true;
    if (!friendIDs.length) {
      setFriends([]);
      return;
    }
    loadUsers(friendIDs)
      .then((list) => live && setFriends(list.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => live && setFriends([]));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return friends;
}
