import { FirebaseError } from 'firebase/app';

/** Turns Firebase error codes into short, human messages. */
export function friendlyError(e: unknown): string {
  if (e instanceof FirebaseError) {
    switch (e.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Wrong email or password';
      case 'auth/invalid-email':
        return "That email doesn't look right";
      case 'auth/email-already-in-use':
        return 'That email already has an account';
      case 'auth/weak-password':
        return 'Password needs at least 6 characters';
      case 'auth/too-many-requests':
        return 'Too many tries. Wait a minute and try again.';
      case 'auth/network-request-failed':
      case 'unavailable':
        return "You're offline. Check your connection and try again.";
      case 'permission-denied':
        return "You can't do that here.";
    }
    return e.message.replace(/^Firebase: /, '').replace(/ \(.*\)\.?$/, '');
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}
