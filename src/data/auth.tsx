import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { getDoc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { auth, db } from '../firebase';
import type { AppUser } from '../lib/types';
import { cleanUsername, signInProblem, signUpProblem } from '../lib/validator';
import { toUser } from './convert';
import { friendlyError } from './errors';
import { publicStatsDoc, userDoc, usernameDoc } from './paths';

interface AuthState {
  /** undefined while Firebase is still restoring the session. */
  user: User | null | undefined;
  /** undefined while loading, null when the account has no profile yet. */
  profile: AppUser | null | undefined;
  signIn(email: string, password: string): Promise<string | null>;
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
      async signIn(email, password) {
        const problem = signInProblem(email, password);
        if (problem) return problem;
        try {
          await signInWithEmailAndPassword(auth, email.trim(), password);
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
        if (!email.includes('@')) return "That email doesn't look right";
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
