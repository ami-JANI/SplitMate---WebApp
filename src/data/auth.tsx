import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { getDoc, onSnapshot, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { auth, db } from '../firebase';
import type { AppUser } from '../lib/types';
import { loginKey } from '../lib/loginKey';
import { cleanUsername, identifierProblem, signUpProblem } from '../lib/validator';
import { toUser } from './convert';
import { friendlyError } from './errors';
import { loginDoc, publicStatsDoc, userDoc, usernameDoc } from './paths';

interface AuthState {
  /** undefined while Firebase is still restoring the session. */
  user: User | null | undefined;
  /** undefined while loading, null when the account has no profile yet. */
  profile: AppUser | null | undefined;
  /** `identifier` is an email or a username. */
  signIn(identifier: string, password: string): Promise<string | null>;
  signUp(input: { name: string; username: string; email: string; password: string; avatar?: string }): Promise<string | null>;
  completeProfile(input: { name: string; username: string; avatar?: string }): Promise<string | null>;
  resetPassword(email: string): Promise<string | null>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}

/** The signed-in user's profile. Only use below a screen that requires sign-in. */
export function useMe(): AppUser {
  const { profile } = useAuth();
  if (!profile) throw new Error('useMe without a profile');
  return profile;
}

/** Writes users/{uid} and reserves usernames/{handle} in one batch. */
async function writeProfile(uid: string, name: string, handle: string, avatar?: string) {
  const batch = writeBatch(db);
  batch.set(userDoc(uid), {
    name: name.trim(),
    username: handle,
    friendIDs: [],
    showsExpenses: true,
    createdAt: serverTimestamp(),
    ...(avatar ? { avatar } : {}),
  });
  batch.set(usernameDoc(handle), { uid });
  batch.set(publicStatsDoc(uid), { visible: true, totalSpentCents: 0, hangoutCount: 0, updatedAt: serverTimestamp() });
  await batch.commit();
}

/**
 * Files the signed-in user's email under a key made from their username and password,
 * so they can sign in with the username next time (see lib/loginKey.ts). Best effort.
 */
async function rememberLogin(user: User, handle: string, password: string) {
  if (!user.email || !handle) return;
  try {
    await setDoc(loginDoc(await loginKey(handle, password)), { uid: user.uid, email: user.email });
  } catch {
    /* username sign-in just stays unavailable until the next email sign-in */
  }
}

const WRONG_USERNAME = 'Wrong username or password. If this keeps failing, sign in with your email once.';

async function usernameTaken(handle: string) {
  return (await getDoc(usernameDoc(handle))).exists();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [profile, setProfile] = useState<AppUser | null | undefined>(undefined);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) {
      setProfile(user === null ? null : undefined);
      return;
    }
    setProfile(undefined);
    return onSnapshot(
      userDoc(user.uid),
      (snap) => setProfile(snap.exists() ? toUser(snap) : null),
      () => setProfile(null),
    );
  }, [user]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      profile,
      async signIn(identifier, password) {
        const problem = identifierProblem(identifier, password);
        if (problem) return problem;
        const id = identifier.trim();
        try {
          if (id.includes('@') && !id.startsWith('@')) {
            // Email: sign in, then make username sign-in work for next time.
            const cred = await signInWithEmailAndPassword(auth, id, password);
            void getDoc(userDoc(cred.user.uid))
              .then((snap) => rememberLogin(cred.user, snap.data()?.username ?? '', password))
              .catch(() => undefined);
            return null;
          }
          // Username: find the email filed under username + password.
          const snap = await getDoc(loginDoc(await loginKey(cleanUsername(id), password)));
          const email = snap.data()?.email;
          if (typeof email !== 'string') return WRONG_USERNAME;
          try {
            await signInWithEmailAndPassword(auth, email, password);
          } catch (e) {
            // The password was changed since; the old entry no longer opens the account.
            return friendlyError(e) === 'Wrong email or password' ? WRONG_USERNAME : friendlyError(e);
          }
          return null;
        } catch (e) {
          return friendlyError(e);
        }
      },
      async signUp({ name, username, email, password, avatar }) {
        const handle = cleanUsername(username);
        const problem = signUpProblem(name, handle, email, password);
        if (problem) return problem;
        try {
          if (await usernameTaken(handle)) return `@${handle} is already taken`;
          const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
          try {
            await writeProfile(cred.user.uid, name, handle, avatar);
            void rememberLogin(cred.user, handle, password);
          } catch {
            // Someone took the username in the meantime. Remove the half-made account.
            await cred.user.delete().catch(() => undefined);
            return `@${handle} is already taken`;
          }
          return null;
        } catch (e) {
          return friendlyError(e);
        }
      },
      async completeProfile({ name, username, avatar }) {
        const handle = cleanUsername(username);
        const problem = signUpProblem(name, handle, 'x@x', 'xxxxxx');
        if (problem) return problem;
        if (!auth.currentUser) return 'You are signed out';
        try {
          if (await usernameTaken(handle)) return `@${handle} is already taken`;
          await writeProfile(auth.currentUser.uid, name, handle, avatar);
          return null;
        } catch (e) {
          return friendlyError(e);
        }
      },
      async resetPassword(email) {
        if (!email.trim()) return 'Type your email first';
        if (!email.includes('@') || email.trim().startsWith('@')) return 'Type your email (not your username) to reset your password';
        try {
          await sendPasswordResetEmail(auth, email.trim());
          return null;
        } catch (e) {
          return friendlyError(e);
        }
      },
      async signOut() {
        await fbSignOut(auth);
      },
    }),
    [user, profile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
