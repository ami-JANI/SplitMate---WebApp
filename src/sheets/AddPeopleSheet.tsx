import { Check, Search, UserPlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Sheet } from '../components/Sheet';
import { Avatar, Empty, ErrorBanner, TwoToneTitle } from '../components/ui';
import { addMember, searchUsers } from '../data/actions';
import { useMe } from '../data/auth';
import { friendlyError } from '../data/errors';
import { useFriends } from '../data/hooks';
import type { AppUser, Hangout } from '../lib/types';

/** Add people to an open hangout: search by username, or pick from your friends. */
export function AddPeopleSheet({ open, onClose, hangout }: { open: boolean; onClose: () => void; hangout: Hangout }) {
  const me = useMe();
  const friends = useFriends(me.friendIDs);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<AppUser[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setResults(null);
      setError(null);
    }
  }, [open]);

  const clean = q.trim().replace(/^@/, '').toLowerCase();
  useEffect(() => {
    if (!clean) {
      setResults(null);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      searchUsers(clean, me.id)
        .then((r) => live && setResults(r))
        .catch((e) => live && setError(friendlyError(e)));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [clean, me.id]);

  const add = async (user: AppUser) => {
    setBusy(user.id);
    setError(await addMember(hangout, user));
    setBusy(null);
  };

  const row = (u: AppUser) => {
    const inside = hangout.memberIDs.includes(u.id);
    return (
      <div key={u.id} className="form-row" style={{ padding: '8px 12px 8px 16px' }}>
        <Avatar avatar={u.avatar} name={u.name} size={38} />
        <span className="grow">
          <span className="w7 ellipsis" style={{ display: 'block' }}>{u.name}</span>
          <span className="t-foot muted">@{u.username}</span>
        </span>
        {inside ? (
          <span className="row gap-4 t-cap w8" style={{ color: 'var(--sage)', paddingRight: 4 }}>
            <Check size={14} strokeWidth={3} /> In hangout
          </span>
        ) : (
          <button
            className="row gap-6 w8 t-sub"
            style={{ background: 'var(--purple)', color: 'var(--white)', borderRadius: 999, padding: '8px 14px', minHeight: 38, opacity: busy === u.id ? 0.6 : 1 }}
            disabled={busy !== null}
            aria-label={`Add ${u.name}`}
            onClick={() => add(u)}
          >
            <UserPlus size={16} /> Add
          </button>
        )}
      </div>
    );
  };

  const friendsOutside = (friends ?? []).filter((f) => !hangout.memberIDs.includes(f.id));
  return (
    <Sheet open={open} onClose={onClose} title="Add people" left={<span />} right={<button className="text-btn" onClick={onClose}>Done</button>}>
      <label className="pill-field" style={{ background: 'var(--sand)', boxShadow: 'none' }}>
        <Search size={20} />
        <input type="search" placeholder="Search by username" value={q} onChange={(e) => setQ(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        {q && <button aria-label="Clear" onClick={() => setQ('')}><X size={18} className="muted" /></button>}
      </label>

      <ErrorBanner message={error} />

      {results && (
        <section className="stack gap-10">
          <TwoToneTitle light="Find" bold="people" size="var(--t-title3)" />
          {results.length === 0 ? <Empty>No one found with @{clean}</Empty> : <div className="form-group">{results.map(row)}</div>}
        </section>
      )}

      <section className="stack gap-10" style={{ minHeight: '30dvh' }}>
        <TwoToneTitle light="My" bold="friends" size="var(--t-title3)" />
        {friends && friends.length === 0 ? (
          <Empty>You have no friends added yet. Search by username above.</Empty>
        ) : friends && friendsOutside.length === 0 ? (
          <Empty>All your friends are already in this hangout.</Empty>
        ) : (
          <div className="form-group">{friendsOutside.map(row)}</div>
        )}
        <p className="form-foot">People you add share the costs added from now on. They can also join with the token.</p>
      </section>
    </Sheet>
  );
}
