import { ArrowUpRight, Bell, Clock, Coffee, Divide, Map as MapIcon, Menu, Plus, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { who } from '../components/BillRow';
import { Avatar, CountUp, Empty, ErrorBanner, PressButton, StatusChip, TwoToneTitle } from '../components/ui';
import { useAppData } from '../data/appData';
import { useMe } from '../data/auth';
import { firstName } from '../lib/avatars';
import { formatTaka } from '../lib/money';
import { useMotion } from '../lib/motion';
import { openTotals } from '../lib/stats';
import { isPaid, type Bill, type Hangout } from '../lib/types';
import { CreateHangoutSheet } from '../sheets/CreateHangoutSheet';
import { JoinSheet } from '../sheets/JoinSheet';
import { NotificationsSheet } from '../sheets/NotificationsSheet';
import { SideMenu } from './SideMenu';

export function Home() {
  const me = useMe();
  const { hangouts, bills, notifications, error } = useAppData();
  const unread = notifications.filter((n) => !n.read).length;
  const { rise, reduce, spring } = useMotion();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<'create' | 'join' | 'notifications' | null>(null);

  const active = hangouts.filter((h) => h.status === 'active');
  const past = hangouts.filter((h) => h.status === 'ended');
  const totals = openTotals(me.id, bills);

  return (
    <>
      <motion.div
        animate={menu && !reduce ? { scale: 0.94, borderRadius: 28 } : { scale: 1, borderRadius: 0 }}
        transition={spring}
        style={{ transformOrigin: 'right center', pointerEvents: menu ? 'none' : undefined, overflow: 'hidden' }}
        aria-hidden={menu || undefined}
      >
        <main className="screen">
          {/* Top bar */}
          <div className="row gap-12">
            <PressButton className="circle-btn" aria-label="Open menu" onClick={() => setMenu(true)}>
              <Menu size={22} />
            </PressButton>
            <div className="grow t-callout muted w6 ellipsis">
              Hello, <span className="w8" style={{ color: 'var(--ink)' }}>{firstName(me.name)}</span>
            </div>
            <PressButton className="circle-btn" aria-label={unread ? `Notifications, ${unread} new` : 'Notifications'} onClick={() => setSheet('notifications')} style={{ position: 'relative' }}>
              <Bell size={22} />
              {unread > 0 && <span className="badge">{unread > 9 ? '9+' : unread}</span>}
            </PressButton>
            <Link to="/profile" aria-label="My profile">
              <Avatar avatar={me.avatar} name={me.name} size={48} />
            </Link>
          </div>

          <motion.h1 className="two-tone" style={{ fontSize: '2.375rem', textTransform: 'none' }} {...rise(0)}>
            <span className="light">Split it</span> <span className="bold">fair.</span>
          </motion.h1>

          <ErrorBanner message={error} />

          {/* Create a hangout */}
          <motion.div {...rise(0.05)}>
            <PressButton className="hero" onClick={() => setSheet('create')} style={{ width: '100%', minHeight: 260, padding: 24, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 14 }} aria-label="Create a hangout">
              <span className="blob" style={{ width: 220, height: 220, right: -70, top: -80, background: 'rgba(255,255,255,0.08)' }} />
              <span className="blob" style={{ width: 150, height: 150, right: -20, bottom: -40, background: 'rgba(255,194,51,0.25)' }} />
              <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
                <TwoToneTitle as="span" light="Create a" bold="Hangout" size="clamp(1.6rem, 8.6vw, 2.125rem)" className="grow" />
                <span className="circle-btn white" style={{ width: 56, height: 56 }}>
                  <ArrowUpRight size={26} strokeWidth={2.5} />
                </span>
              </div>
              <span className="w6 t-sub" style={{ display: 'block', opacity: 0.92, maxWidth: 300 }}>
                Dinner, movie, a day out? Start one, share the token, and add costs as you go.
              </span>
              <div className="row gap-6" style={{ marginTop: 'auto', flexWrap: 'wrap' }}>
                <span className="glass-tag"><Clock size={13} /> 1-day token</span>
                <span className="glass-tag"><Divide size={13} /> Fair split</span>
                <span className="glass-tag"><MapIcon size={13} /> Tours</span>
              </div>
            </PressButton>
          </motion.div>

          {/* Join */}
          <motion.div {...rise(0.1)}>
            <PressButton onClick={() => setSheet('join')} className="row gap-12" style={{ width: '100%', background: 'var(--yellow)', borderRadius: 'var(--r-big)', padding: '20px 22px', textAlign: 'left' }}>
              <div className="grow">
                <TwoToneTitle as="span" light="Got a" bold="token?" size="var(--t-title2)" />
                <span className="t-sub w6" style={{ display: 'block', opacity: 0.8 }}>Join a friend's hangout or tour</span>
              </div>
              <span className="circle-btn white" style={{ color: 'var(--ink)' }}>
                <Plus size={24} strokeWidth={2.5} />
              </span>
            </PressButton>
          </motion.div>

          {/* Owe banner */}
          {(totals.owe > 0 || totals.owed > 0) && (
            <motion.div className="card row" style={{ padding: '14px 8px' }} {...rise(0.15)}>
              <div className="grow center stack gap-4">
                <span className="label muted">You owe</span>
                <CountUp cents={totals.owe} className="t-title2" style={{ color: '#C98F00' }} />
              </div>
              <span className="divider" />
              <div className="grow center stack gap-4">
                <span className="label muted">Owed to you</span>
                <CountUp cents={totals.owed} className="t-title2" style={{ color: 'var(--sage)' }} />
              </div>
            </motion.div>
          )}

          {/* Happening now */}
          {active.length > 0 && (
            <section className="stack gap-12">
              <TwoToneTitle light="Happening" bold="now" className="section-title" />
              <div className="list">
                <AnimatePresence initial={false}>
                  {active.map((h) => (
                    <motion.div key={h.id} layout={!reduce} initial={{ opacity: 0, y: reduce ? 0 : -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring}>
                      <ActiveRow hangout={h} onOpen={() => navigate(`/hangout/${h.id}`)} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          {/* Past hangouts */}
          <section className="stack gap-12">
            <TwoToneTitle light="Past" bold="hangouts" className="section-title" />
            {past.length === 0 ? (
              <Empty icon={<Sparkles size={26} color="var(--purple)" />}>Ended hangouts and their bills show up here.</Empty>
            ) : (
              <div className="list" style={{ gap: 14 }}>
                <AnimatePresence initial={false}>
                  {past.map((h) => (
                    <motion.div key={h.id} layout={!reduce} initial={{ opacity: 0, y: reduce ? 0 : 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring}>
                      <PastCard hangout={h} bills={bills.filter((b) => b.hangoutID === h.id)} me={me.id} onOpen={() => navigate(`/hangout/${h.id}`)} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>
        </main>
      </motion.div>

      <SideMenu open={menu} onClose={() => setMenu(false)} />
      <CreateHangoutSheet open={sheet === 'create'} onClose={() => setSheet(null)} />
      <NotificationsSheet open={sheet === 'notifications'} onClose={() => setSheet(null)} />
      <JoinSheet open={sheet === 'join'} onClose={() => setSheet(null)} />
    </>
  );
}

function KindTile({ kind, size = 48 }: { kind: Hangout['kind']; size?: number }) {
  return (
    <span className="icon-tile" style={{ width: size, height: size, background: kind === 'tour' ? 'var(--sage)' : 'var(--purple)' }}>
      {kind === 'tour' ? <MapIcon size={22} /> : <Coffee size={22} />}
    </span>
  );
}

function ActiveRow({ hangout: h, onOpen }: { hangout: Hangout; onOpen: () => void }) {
  return (
    <PressButton className="list-row" onClick={onOpen}>
      <KindTile kind={h.kind} />
      <div className="grow">
        <div className="w8 ellipsis">{h.title}</div>
        <div className="t-foot muted w6">
          {h.kind === 'tour' ? 'Tour' : 'Hangout'} · {h.memberIDs.length} {h.memberIDs.length === 1 ? 'person' : 'people'}
        </div>
      </div>
      <div className="stack" style={{ alignItems: 'flex-end' }}>
        <CountUp cents={h.totalSpentCents} className="t-callout" />
        <span className="live-label">LIVE</span>
      </div>
    </PressButton>
  );
}

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function PastCard({ hangout: h, bills, me, onOpen }: { hangout: Hangout; bills: Bill[]; me: string; onOpen: () => void }) {
  const paid = bills.filter((b) => isPaid(b.status)).length;
  return (
    <PressButton className="card card-big stack gap-12" onClick={onOpen} style={{ width: '100%', textAlign: 'left' }}>
      <div className="row gap-12" style={{ alignItems: 'flex-start' }}>
        <div className="grow">
          <span className="heading t-title2" style={{ display: 'block', textTransform: 'uppercase', lineHeight: 1.05, overflowWrap: 'anywhere' }}>{h.title}</span>
          <div className="t-foot muted w6">
            {dateFmt.format(h.endedAt ?? h.createdAt)} · {h.memberIDs.length} people
          </div>
        </div>
        <div className="stack" style={{ alignItems: 'flex-end' }}>
          <span className="label muted t-cap2">Total</span>
          <span className="num t-title2" style={{ color: 'var(--purple)' }}>{formatTaka(h.totalSpentCents)}</span>
        </div>
      </div>
      {bills.length === 0 ? (
        <span className="t-sub muted w6">Everyone paid their own share. Nothing to settle.</span>
      ) : (
        <>
          <div className="stack gap-8">
            {bills.map((b) => (
              <div key={b.id} className="row gap-8 t-sub">
                <span className="grow w7 ellipsis">
                  {who(b.fromID, b.fromName, me)} <span className="muted">→</span> {who(b.toID, b.toName, me)}
                </span>
                <span className="num">{formatTaka(b.amountCents)}</span>
                <StatusChip status={b.status} />
              </div>
            ))}
          </div>
          <div className="progress" aria-hidden>
            <motion.div initial={false} animate={{ width: `${(paid / bills.length) * 100}%` }} />
          </div>
          <div className="t-cap muted w7">
            {paid} of {bills.length} bills paid
          </div>
        </>
      )}
    </PressButton>
  );
}
