import { CalendarDays, ChevronRight, LogOut, Search, User, Users, Wallet, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Avatar, CircleButton, CountUp, TwoToneTitle } from '../components/ui';
import { loadAllExpenses, publishStats } from '../data/actions';
import { useAppData } from '../data/appData';
import { useAuth, useMe } from '../data/auth';
import { formatTaka } from '../lib/money';
import { useMotion } from '../lib/motion';
import { spendingSummary, type PersonAmount, type SpendingSummary } from '../lib/stats';

/** Slides in from the left over a scrim; close with ✕, the scrim, Escape or a swipe left. */
export function SideMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMe();
  const { signOut } = useAuth();
  const { hangouts, bills } = useAppData();
  const { reduce, spring, rise } = useMotion();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<SpendingSummary | null>(null);

  // On open: load every cost of every hangout once, compute the numbers and publish the shareable part.
  useEffect(() => {
    if (!open) return;
    let live = true;
    loadAllExpenses(hangouts).then((expenses) => {
      if (!live) return;
      const s = spendingSummary(me.id, hangouts, expenses, bills);
      setSummary(s);
      void publishStats(me, s).catch(() => undefined);
    });
    return () => {
      live = false;
    };
    // Recompute only when the menu opens, as the iOS app does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  const s = summary;
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="scrim" className="menu-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={onClose} />
          <motion.nav
            key="menu"
            className="menu-panel"
            aria-label="Menu"
            initial={reduce ? { opacity: 0 } : { x: '-100%', opacity: 0.6 }}
            animate={reduce ? { opacity: 1 } : { x: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { x: '-100%', opacity: 0.6 }}
            transition={spring}
            drag={reduce ? false : 'x'}
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.9, right: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.x < -80 || info.velocity.x < -500) onClose();
            }}
          >
            <div className="row gap-12">
              <Avatar avatar={me.avatar} name={me.name} size={58} />
              <div className="grow">
                <div className="heading t-title3 ellipsis">{me.name}</div>
                <div className="t-sub muted w6 ellipsis">@{me.username}</div>
              </div>
              <CircleButton className="sm" aria-label="Close menu" onClick={onClose}>
                <X size={18} />
              </CircleButton>
            </div>

            <div className="stack gap-8">
              <MenuButton icon={<User size={18} color="var(--purple)" />} onClick={() => go('/profile')}>My profile</MenuButton>
              <MenuButton icon={<Search size={18} color="var(--purple)" />} onClick={() => go('/friends')}>Find friends</MenuButton>
            </div>

            <TwoToneTitle light="My" bold="numbers" size="var(--t-title3)" />

            <motion.div className="stack gap-10" {...rise(0.05)}>
              <PeopleTile title="I owe" people={s?.iOwe} empty="You don't owe anyone" bg="var(--light-yellow)" />
              <PeopleTile title="Owes me" people={s?.owedToMe} empty="Nobody owes you" bg="var(--lavender)" />
            </motion.div>

            <motion.div className="tile-grid" {...rise(0.1)}>
              <StatTile bg="var(--purple)" fg="var(--white)" icon={<Wallet size={16} />} label="Total spend" caption="your share, all hangouts">
                {s ? <CountUp cents={s.totalSpentCents} className="tile-value" /> : <span className="tile-value">…</span>}
              </StatTile>
              <StatTile bg="var(--sage)" fg="var(--white)" icon={<Users size={16} />} label="Per hangout" caption={`average over ${s?.perHangout.length ?? 0}`}>
                <span className="tile-value">{s ? formatTaka(s.perHangout.length ? Math.round(s.totalSpentCents / s.perHangout.length) : 0) : '…'}</span>
              </StatTile>
              <StatTile bg="var(--yellow)" fg="var(--ink)" icon={<CalendarDays size={16} />} label="Top day" caption="you spend most on">
                <span className="tile-word">{s?.busiestWeekday ?? '—'}</span>
              </StatTile>
              <StatTile bg="var(--deep-purple)" fg="var(--white)" icon={<CalendarDays size={16} />} label="Top month" caption="your biggest month">
                <span className="tile-word">{s?.busiestMonth ?? '—'}</span>
              </StatTile>
            </motion.div>

            <div className="tile" style={{ background: 'var(--ink)', color: 'var(--white)', minHeight: 0 }}>
              <span className="label row gap-6" style={{ opacity: 0.8 }}><Users size={14} /> Most transactions with</span>
              <span className="tile-word">{s?.topPartner?.name ?? '—'}</span>
              <span className="t-cap w7" style={{ opacity: 0.75 }}>
                {s?.topPartner ? `${s.topPartner.amount} ${s.topPartner.amount === 1 ? 'bill' : 'bills'} together` : 'No bills yet'}
              </span>
            </div>

            {s && s.perHangout.length > 0 && (
              <div className="card stack gap-8">
                <span className="label muted">Spend per hangout</span>
                {s.perHangout.map((p) => (
                  <div key={p.id} className="row gap-8 t-sub">
                    <span className="grow w7 ellipsis">{p.name}</span>
                    <span className="num" style={{ color: 'var(--purple)' }}>{formatTaka(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            <button className="menu-btn" style={{ color: 'var(--danger)' }} onClick={() => signOut()}>
              <LogOut size={18} /> Sign out
            </button>
          </motion.nav>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function MenuButton({ icon, children, onClick }: { icon: ReactNode; children: ReactNode; onClick: () => void }) {
  return (
    <button className="menu-btn" onClick={onClick}>
      {icon}
      <span className="grow">{children}</span>
      <ChevronRight size={18} className="muted" />
    </button>
  );
}

function PeopleTile({ title, people, empty, bg }: { title: string; people?: PersonAmount[]; empty: string; bg: string }) {
  return (
    <div className="tile" style={{ background: bg, minHeight: 0 }}>
      <span className="label" style={{ opacity: 0.7 }}>{title}</span>
      {!people ? (
        <span className="t-sub w6 muted">…</span>
      ) : people.length === 0 ? (
        <span className="t-sub w7" style={{ opacity: 0.7 }}>{empty}</span>
      ) : (
        people.map((p) => (
          <div key={p.id} className="row gap-8">
            <Avatar avatar={p.avatar} name={p.name} size={26} />
            <span className="grow w7 t-sub ellipsis">{p.name}</span>
            <span className="num">{formatTaka(p.amount)}</span>
          </div>
        ))
      )}
    </div>
  );
}

function StatTile({ bg, fg, icon, label, caption, children }: { bg: string; fg: string; icon: ReactNode; label: string; caption: string; children: ReactNode }) {
  return (
    <div className="tile" style={{ background: bg, color: fg }}>
      <span className="label row gap-4" style={{ opacity: 0.85 }}>{icon} {label}</span>
      {children}
      <span className="t-cap2 w7" style={{ opacity: 0.8, marginTop: 'auto' }}>{caption}</span>
    </div>
  );
}
