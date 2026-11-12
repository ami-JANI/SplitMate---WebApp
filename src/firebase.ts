import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

export const usingEmulators = env.VITE_USE_EMULATORS === 'true';
export const isConfigured = usingEmulators || Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

export const app = initializeApp(usingEmulators ? { ...firebaseConfig, apiKey: firebaseConfig.apiKey || 'demo-key', projectId: firebaseConfig.projectId || 'demo-splitmate' } : firebaseConfig);
export const auth = getAuth(app);
// Offline cache so hangouts, costs and bills can be read without a connection.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (usingEmulators) {
  const host = env.VITE_EMULATOR_HOST || location.hostname;
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
}
