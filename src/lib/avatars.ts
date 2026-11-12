// The eight avatars (docs/HANDOFF.md §3.13). Only the id is stored.
export const AVATARS = [
  { id: 'nova', name: 'Nova' },
  { id: 'rio', name: 'Rio' },
  { id: 'sky', name: 'Sky' },
  { id: 'zara', name: 'Zara' },
  { id: 'kai', name: 'Kai' },
  { id: 'mimi', name: 'Mimi' },
  { id: 'leo', name: 'Leo' },
  { id: 'ash', name: 'Ash' },
] as const;

export const avatarSrc = (id: string) => `/avatars/${id}.svg`;
export const isAvatar = (id: string | undefined): id is string => !!id && AVATARS.some((a) => a.id === id);

const INITIAL_COLORS = ['var(--purple)', 'var(--yellow)', 'var(--sage)', 'var(--deep-purple)'];

/** Same name, same colour, on every device. */
export function initialsColor(name: string): string {
  let sum = 0;
  for (const ch of name) sum += ch.codePointAt(0) ?? 0;
  return INITIAL_COLORS[sum % 4];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => [...p][0]?.toUpperCase() ?? '')
    .join('') || '?';
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
