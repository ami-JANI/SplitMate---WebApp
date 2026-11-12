import { ArrowDownLeft, ArrowUpRight, CalendarDays, Check, ChevronRight, Eye, EyeOff, LogOut, Paintbrush, Pencil, Search, UserCheck, UserMinus, UserPlus, Wallet, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BillRow } from '../components/BillRow';
import { Sheet } from '../components/Sheet';
import { Avatar, CountUp, Empty, ErrorBanner, PillButton, PressButton, Switch, SwipeRow, TopBar, TwoToneTitle } from '../components/ui';
import { addFriend, removeFriend, searchUsers, setShowsExpenses, updateName } from '../data/actions';
import { useAppData } from '../data/appData';
import { useAuth, useMe } from '../data/auth';
import { friendlyError } from '../data/errors';
import { useFriends, usePublicStats, useUser } from '../data/hooks';
import { auth } from '../firebase';
import { firstName } from '../lib/avatars';
import { formatTaka } from '../lib/money';
import { useMotion } from '../lib/motion';
import { openTotals } from '../lib/stats';
import type { AppUser } from '../lib/types';
import { ChooseAvatarSheet } from '../sheets/ChooseAvatarSheet';

// ---------------------------------------------------------------- My profile

export function MyProfile() {
  const me = useMe();
  const { signOut } = useAuth();
  const { bills, hangouts } = useAppData();
  const friends = useFriends(me.friendIDs);
  const navigate = useNavigate();
  const [avatarSheet, setAvatarSheet] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const totals = openTotals(me.id, bills);

  const togglePrivacy = async (on: boolean) => setError(await setShowsExpenses(me.id, on));

  return (
    <>
      <TopBar title="My profile" />
      <main className="screen" style={{ paddingTop: 4 }}>
        <section className="card card-big stack gap-6" style={{ background: 'var(--lavender)', alignItems: 'center', textAlign: 'center', padding: 26 }}>
          <button onClick={() => setAvatarSheet(true)} aria-label="Change avatar" style={{ position: 'relative' }}>
            <Avatar avatar={me.avatar} name={me.name} size={96} />
            <span className="crown" style={{ width: 30, height: 30, background: 'var(--purple)', color: 'var(--white)', right: -2, top: 'auto', bottom: 0 }}>
              <Paintbrush size={15} />
            </span>
          </button>
          <span className="t-cap muted w7">Tap to change avatar</span>
          <div className="row gap-6" style={{ justifyContent: 'center', marginTop: 4, maxWidth: '100%' }}>
            <h1 className="heading" style={{ fontSize: 'var(--t-title)', textTransform: 'uppercase', lineHeight: 1.05, overflowWrap: 'anywhere' }}>{me.name}</h1>
            <button className="circle-btn sm" style={{ background: 'transparent', color: 'var(--purple)' }} aria-label="Change your name" onClick={() => setRenaming(true)}>
              <Pencil size={18} />
            </button>
          </div>
          <span className="w8" style={{ color: 'var(--purple)' }}>@{me.username}</span>
          <span className="t-sub muted w6">{auth.currentUser?.email}</span>
        </section>

        <ErrorBanner message={error} />

        <section className="card stack gap-8">
          <label className="row gap-10">
            {me.showsExpenses ? <Eye size={20} color="var(--purple)" /> : <EyeOff size={20} className="muted" />}
            <span className="grow w8">Show my spending to others</span>
            <Switch label="Show my spending to others" checked={me.showsExpenses} onChange={togglePrivacy} />
          </label>
          <p className="t-foot muted w6">
            {me.showsExpenses
              ? 'Hangout members can see your total spend, busiest day and month on your profile.'
              : 'Your spending is hidden. Others only see your name and username.'}
          </p>
        </section>

        <div className="tile-grid">
          <div className="tile" style={{ background: 'var(--yellow)' }}>
            <span className="label row gap-4"><ArrowUpRight size={14} /> I owe</span>
            <CountUp cents={totals.owe} className="tile-value" />
          </div>
          <div className="tile" style={{ background: 'var(--sage)', color: 'var(--white)' }}>
            <span className="label row gap-4"><ArrowDownLeft size={14} /> Owed to me</span>
            <CountUp cents={totals.owed} className="tile-value" />
          </div>
        </div>

        <section className="stack gap-12">
          <div className="row">
            <TwoToneTitle light="My" bold="friends" className="section-title grow" />
            <Link to="/friends" className="row gap-4 t-sub"><Search size={16} /> Find</Link>
          </div>
          {friends && friends.length === 0 && <Empty>Search by username to add friends.</Empty>}
          <div className="list">
            {friends?.map((f) => <UserRow key={f.id} user={f} onOpen={() => navigate(`/member/${f.id}`)} />)}
          </div>
        </section>

        <PillButton variant="danger" icon={<LogOut size={20} />} onClick={() => signOut()}>Sign out</PillButton>
      </main>

      <ChooseAvatarSheet open={avatarSheet} onClose={() => setAvatarSheet(false)} />
      <RenameSheet open={renaming} onClose={() => setRenaming(false)} me={me} hangoutsCount={hangouts.length} />
    </>
  );
}

function RenameSheet({ open, onClose, me }: { open: boolean; onClose: () => void; me: AppUser; hangoutsCount: number }) {
  const { hangouts } = useAppData();
  const [name, setName] = useState(me.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setName(me.name);
      setError(null);
    }
  }, [open, me.name]);

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    const problem = await updateName(me, name, hangouts);
    setBusy(false);
    if (problem) return setError(problem);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Change your name" left={<button className="text-btn" onClick={onClose}>Cancel</button>} right={<button className="text-btn" onClick={() => save()} disabled={busy}>Save</button>}>
      <form onSubmit={save} className="stack gap-12">
        <div className="form-group">
          <label className="form-row">
            <span className="sr-only">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} autoFocus autoComplete="name" />
          </label>
        </div>
        <p className="form-foot">Your new name shows in your hangouts. Bills already made keep the old name.</p>
        <ErrorBanner message={error} />
      </form>
    </Sheet>
  );
}

// ---------------------------------------------------------------- Shared rows

export function UserRow({ user, onOpen, trailing }: { user: AppUser; onOpen: () => void; trailing?: React.ReactNode }) {
  return (
    <div className="list-row" style={{ padding: 0 }}>
      <PressButton onClick={onOpen} className="row gap-12 grow" style={{ padding: '12px 0 12px 14px', textAlign: 'left' }}>
        <Avatar avatar={user.avatar} name={user.name} size={42} />
        <span className="grow">
          <span className="w8 ellipsis" style={{ display: 'block' }}>{user.name}</span>
          <span className="t-foot muted w6">@{user.username}</span>
        </span>
        {!trailing && <ChevronRight size={18} className="muted" style={{ marginRight: 14 }} />}
      </PressButton>
      {trailing && <div style={{ paddingRight: 10 }}>{trailing}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- Member profile

export function MemberProfile() {
  const { id = '' } = useParams();
  const me = useMe();
  const user = useUser(id);
  const stats = usePublicStats(id);
  const { bills } = useAppData();
  const [error, setError] = useState<string | null>(null);
  const isFriend = me.friendIDs.includes(id);
  const between = bills.filter((b) => (b.fromID === me.id && b.toID === id) || (b.toID === me.id && b.fromID === id));

  if (user === undefined) return (<><TopBar title="" /><main className="screen"><div className="empty">Loading…</div></main></>);
  if (user === null) return (<><TopBar title="" /><main className="screen"><Empty>This person doesn't exist any more.</Empty></main></>);

  const toggleFriend = async () => {
    try {
      if (isFriend) await removeFriend(me.id, id);
      else await addFriend(me, id);
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  const first = firstName(user.name);
  return (
    <>
      <TopBar title={user.name} />
      <main className="screen" style={{ paddingTop: 4 }}>
        <section className="hero stack gap-6" style={{ alignItems: 'center', textAlign: 'center', padding: 26 }}>
          <span className="blob" style={{ width: 180, height: 180, left: -60, top: -70, background: 'rgba(255,255,255,0.08)' }} />
          <Avatar avatar={user.avatar} name={user.name} size={92} />
          <h1 className="heading" style={{ fontSize: 'var(--t-title)', textTransform: 'uppercase', marginTop: 6, lineHeight: 1.05, overflowWrap: 'anywhere' }}>{user.name}</h1>
          <span className="w8" style={{ color: 'var(--yellow)' }}>@{user.username}</span>
          {id !== me.id && (
            <PressButton onClick={toggleFriend} className="row gap-6 w8 t-sub" style={{ marginTop: 8, padding: '9px 16px', borderRadius: 999, background: isFriend ? 'var(--lavender)' : 'var(--white)', color: 'var(--deep-purple)' }}>
              {isFriend ? <><Check size={16} strokeWidth={3} /> Friends</> : <><UserPlus size={16} /> Add friend</>}
            </PressButton>
          )}
        </section>

        <ErrorBanner message={error} />

        <section className="stack gap-12">
          <TwoToneTitle light="Their" bold="spending" className="section-title" />
          {stats === undefined ? (
            <div className="empty">Loading…</div>
          ) : stats === 'hidden' || (stats && !stats.visible) || !user.showsExpenses ? (
            <Empty icon={<EyeOff size={24} />}>{first} keeps their spending private.</Empty>
          ) : !stats || stats.hangoutCount === 0 ? (
            <Empty>{first} hasn't shared any spending yet.</Empty>
          ) : (
            <div className="tile-grid">
              <div className="tile" style={{ background: 'var(--purple)', color: 'var(--white)' }}>
                <span className="label row gap-4"><Wallet size={14} /> Total spend</span>
                <span className="tile-value">{formatTaka(stats.totalSpentCents)}</span>
                <span className="t-cap2 w7" style={{ opacity: 0.8, marginTop: 'auto' }}>over {stats.hangoutCount} {stats.hangoutCount === 1 ? 'hangout' : 'hangouts'}</span>
              </div>
              <div className="tile" style={{ background: 'var(--yellow)' }}>
                <span className="label row gap-4"><CalendarDays size={14} /> Top day</span>
                <span className="tile-word">{stats.busiestWeekday ?? '—'}</span>
                <span className="t-cap2 w7" style={{ opacity: 0.7, marginTop: 'auto' }}>busiest month: {stats.busiestMonth ?? '—'}</span>
              </div>
            </div>
          )}
        </section>

        {between.length > 0 && (
          <section className="stack gap-12">
            <TwoToneTitle light="Between" bold="us" className="section-title" />
            <div className="list">
              {between.map((b) => <BillRow key={b.id} bill={b} me={me.id} tracker={false} showHangout />)}
            </div>
          </section>
        )}
      </main>
    </>
  );
}

// ---------------------------------------------------------------- Find friends

export function FindFriends() {
  const me = useMe();
  const navigate = useNavigate();
  const friends = useFriends(me.friendIDs);
  const { reduce, spring } = useMotion();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<AppUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const clean = q.trim().replace(/^@/, '').toLowerCase();
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
  }, [q, me.id]);

  const toggle = async (uid: string, add: boolean) => {
    try {
      if (add) await addFriend(me, uid);
      else await removeFriend(me.id, uid);
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  return (
    <>
      <TopBar title="Friends" />
      <main className="screen" style={{ paddingTop: 4 }}>
        <label className="pill-field" style={{ background: 'var(--sand)', boxShadow: 'none' }}>
          <Search size={20} />
          <input type="search" placeholder="Search by username" value={q} onChange={(e) => setQ(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus />
          {q && <button aria-label="Clear" onClick={() => setQ('')}><X size={18} className="muted" /></button>}
        </label>

        <ErrorBanner message={error} />

        {results && (
          <section className="stack gap-12">
            <TwoToneTitle light="Find" bold="people" className="section-title" />
            {results.length === 0 ? (
              <Empty>No one found with @{q.trim().replace(/^@/, '').toLowerCase()}</Empty>
            ) : (
              <div className="list">
                {results.map((u) => {
                  const friend = me.friendIDs.includes(u.id);
                  return (
                    <UserRow
                      key={u.id}
                      user={u}
                      onOpen={() => navigate(`/member/${u.id}`)}
                      trailing={
                        <button className="circle-btn sm" style={{ background: friend ? 'transparent' : 'var(--lavender)', color: friend ? 'var(--sage)' : 'var(--purple)' }} aria-label={friend ? `Remove ${u.name}` : `Add ${u.name}`} onClick={() => toggle(u.id, !friend)}>
                          {friend ? <UserCheck size={20} /> : <UserPlus size={20} />}
                        </button>
                      }
                    />
                  );
                })}
              </div>
            )}
          </section>
        )}

        <section className="stack gap-12">
          <TwoToneTitle light="My" bold="friends" className="section-title" />
          {friends && friends.length === 0 && <Empty>Search by username to add friends.</Empty>}
          <div className="list">
            <AnimatePresence initial={false}>
              {friends?.map((f) => (
                <motion.div key={f.id} layout={!reduce} exit={{ opacity: 0, height: 0 }} transition={spring}>
                  <SwipeRow actionLabel="Remove" actionIcon={<UserMinus size={18} />} onAction={() => toggle(f.id, false)}>
                    <UserRow
                      user={f}
                      onOpen={() => navigate(`/member/${f.id}`)}
                      trailing={
                        <button className="circle-btn sm" style={{ background: 'transparent', color: 'var(--muted-ink)' }} aria-label={`Remove ${f.name}`} onClick={() => toggle(f.id, false)}>
                          <UserMinus size={18} />
                        </button>
                      }
                    />
                  </SwipeRow>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          {friends && friends.length > 0 && <p className="t-cap muted w6 center">Swipe a friend left, or tap the minus, to remove them.</p>}
        </section>
      </main>
    </>
  );
}
