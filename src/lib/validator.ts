// Input checks. Each returns the first problem as a message, or null when valid.
// Messages match the iOS app (docs/HANDOFF.md §3.2, §3.5, §3.8).

export const MIN_PASSWORD = 6;
export const MAX_TOUR_DAYS = 30;

/**
 * A practical email check: one "@", no spaces, a dot in the domain, a 2+ letter
 * ending, and no empty or doubled dots. Firebase still has the final say.
 */
export function isEmail(raw: string): boolean {
  const email = raw.trim();
  if (email.length > 254) return false;
  const m = /^([^\s@]+)@([^\s@]+)$/.exec(email);
  if (!m) return false;
  const [, local, domain] = m;
  if (local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  const labels = domain.split('.');
  if (labels.length < 2) return false;
  if (!labels.every((l) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(l))) return false;
  return /^[a-z]{2,}$/i.test(labels[labels.length - 1]);
}

/** True when the sign-in text should be treated as an email rather than a username. */
export const looksLikeEmail = (raw: string) => {
  const id = raw.trim();
  return id.includes('@') && !id.startsWith('@');
};

export function emailProblem(email: string): string | null {
  if (!email.trim()) return 'Email is missing';
  if (!isEmail(email)) return "That email doesn't look right";
  return null;
}

export function signInProblem(email: string, password: string): string | null {
  const e = emailProblem(email);
  if (e) return e;
  if (!password) return 'Password is missing';
  return null;
}

/** Sign-in accepts an email or a username. */
export function identifierProblem(identifier: string, password: string): string | null {
  const id = identifier.trim();
  if (!id) return 'Email or username is missing';
  if (looksLikeEmail(id)) {
    if (!isEmail(id)) return "That email doesn't look right";
  } else if (usernameProblem(cleanUsername(id))) {
    return "That username doesn't look right";
  }
  if (!password) return 'Password is missing';
  return null;
}

export function usernameProblem(username: string): string | null {
  if (!username) return 'Username is missing';
  if (username.length < 3 || username.length > 20) return 'Username must be 3-20 characters';
  if (!/^[a-z0-9_.]+$/.test(username.toLowerCase())) return 'Use only letters, numbers, dots and underscores';
  return null;
}

export function signUpProblem(name: string, username: string, email: string, password: string): string | null {
  if (!name.trim()) return 'Name is missing';
  const u = usernameProblem(username);
  if (u) return u;
  const s = signInProblem(email, password);
  if (s) return s;
  if (password.length < MIN_PASSWORD) return `Password needs at least ${MIN_PASSWORD} characters`;
  return null;
}

export function hangoutProblem(title: string, kind: 'hangout' | 'tour', days: number): string | null {
  if (!title.trim()) return 'Give it a name';
  if (kind === 'tour' && (days < 2 || days > MAX_TOUR_DAYS)) return `A tour lasts 2 to ${MAX_TOUR_DAYS} days`;
  return null;
}

export function expenseProblem(title: string, amountCents: number | undefined, splitCount: number): string | null {
  if (!title.trim()) return 'Title is missing';
  if (amountCents === undefined) return 'Amount is missing';
  if (Number.isNaN(amountCents)) return "That amount doesn't look right";
  if (amountCents <= 0) return 'Amount must be greater than zero';
  if (splitCount <= 0) return 'Pick at least one person to split with';
  return null;
}

/** Lowercase, without a leading "@" and spaces. */
export const cleanUsername = (raw: string) => raw.trim().replace(/^@/, '').toLowerCase();
