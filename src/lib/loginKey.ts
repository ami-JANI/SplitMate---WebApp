// Signing in with a username, without a server and without exposing emails.
//
// Firebase signs people in by email. To accept a username we need its email, but
// a public "username -> email" list would let anyone look up anyone's email. So
// the email is filed under a key made from the username AND the password
// (logins/{key}). Only someone who types both can find it; the collection can't
// be listed, and there is nothing to download and guess against offline.

const ITERATIONS = 210_000;

/** 64 hex characters derived from the username (lowercase) and the password. */
export async function loginKey(username: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(`splitmate-login:${username.trim().toLowerCase()}`), iterations: ITERATIONS },
    material,
    256,
  );
  return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, '0')).join('');
}
