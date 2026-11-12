import { collection, doc } from 'firebase/firestore';
import { db } from '../firebase';

export const usersCol = () => collection(db, 'users');
export const userDoc = (uid: string) => doc(db, 'users', uid);
export const notificationsCol = (uid: string) => collection(db, 'users', uid, 'notifications');
export const usernameDoc = (handle: string) => doc(db, 'usernames', handle);
export const publicStatsDoc = (uid: string) => doc(db, 'publicStats', uid);
export const hangoutsCol = () => collection(db, 'hangouts');
export const hangoutDoc = (id: string) => doc(db, 'hangouts', id);
export const expensesCol = (hangoutID: string) => collection(db, 'hangouts', hangoutID, 'expenses');
export const noticesCol = (hangoutID: string) => collection(db, 'hangouts', hangoutID, 'notices');
export const tokenDoc = (token: string) => doc(db, 'hangoutTokens', token);
export const billsCol = () => collection(db, 'bills');
export const billDoc = (id: string) => doc(db, 'bills', id);
