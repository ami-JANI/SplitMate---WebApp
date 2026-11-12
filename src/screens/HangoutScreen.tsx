import { Bell, Check, CheckCircle2, Clock, Coffee, Copy, Crown, Flag, Map as MapIcon, Plus, Share2, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BillRow } from '../components/BillRow';
import { Confirm } from '../components/Confirm';
import { LiveSplitCard } from '../components/LiveSplitCard';
import { Avatar, CountUp, Empty, ErrorBanner, PillButton, SwipeRow, TopBar, TwoToneTitle } from '../components/ui';
import { deleteExpense, endHangout, settleFinishedTourDays } from '../data/actions';
import { useAppData } from '../data/appData';
import { useMe } from '../data/auth';
import { useHangoutDetail } from '../data/hooks';
import { dayHeader, todayKey } from '../lib/dayKey';
import { formatTaka } from '../lib/money';
import { useMotion } from '../lib/motion';
import { shareOf } from '../lib/settlement';
import { memberAvatar, memberName, type Expense, type Hangout } from '../lib/types';
import { AddCostSheet } from '../sheets/AddCostSheet';

const validFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });

export function HangoutScreen() {
  const { id = '' } = useParams();
  const me = useMe();
  const navigate = useNavigate();
  const { hangouts, bills, loaded } = useAppData();
  const hangout = hangouts.find((h) => h.id === id);
  const { expenses, expensesLoaded, notices, error, setError } = useHangoutDetail(id);
  const { reduce, spring } = useMotion();
  const [adding, setAdding] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);

  // Tours: settle finished days on open, when the costs change, and every minute.
  const latest = useRef({ hangout, expenses });
  latest.current = { hangout, expenses };
  useEffect(() => {
    if (!hangout || hangout.kind !== 'tour' || hangout.status !== 'active' || !expensesLoaded) return;
    const run = () => {
      const { hangout: h, expenses: e } = latest.current;
      if (h) void settleFinishedTourDays(h, e).then((p) => p && setError(p));
    };
    run();
    const t = window.setInterval(run, 60_000);
    return () => window.clearInterval(t);
  }, [hangout?.id, hangout?.kind, hangout?.status, expenses.length, expensesLoaded, setError]);

  if (!hangout) {
    return (
      <>
        <TopBar title="" />
        <main className="screen">
          {loaded ? <Empty>This hangout isn't available. You may not be a member.</Empty> : <div className="empty">Loading…</div>}
        </main>
      </>
    );
  }

  const active = hangout.status === 'active';
  const myBills = bills.filter((b) => b.hangoutID === hangout.id);
  const hasOpenCosts = expenses.some((e) => !hangout.settledDays.includes(e.dayKey));
  const isCreator = hangout.creatorID === me.id;

  const end = async () => {
    setConfirmEnd(false);
    setEnding(true);
    const problem = await endHangout(hangout, me.id, expenses);
    setEnding(false);
    if (problem) setError(problem);
  };

  return (
    <>
      <TopBar
        title={hangout.title}
        right={
          active && (
            <button className="circle-btn" aria-label="Add a cost" onClick={() => setAdding(true)} style={{ width: 40, height: 40, background: 'transparent', color: 'var(--purple)' }}>
              <Plus size={26} strokeWidth={2.5} style={{ border: '2px solid currentColor', borderRadius: '50%', padding: 2 }} />
            </button>
          )
        }
      />
      <main className="screen" style={{ paddingTop: 4 }}>
        <HeaderCard hangout={hangout} />

        {/* Members */}
        <div className="member-strip" role="list" aria-label="Members">
          {hangout.memberIDs.map((uid) => (
            <button key={uid} role="listitem" onClick={() => navigate(uid === me.id ? '/profile' : `/member/${uid}`)}>
              <span style={{ position: 'relative' }}>
                <Avatar avatar={memberAvatar(hangout, uid)} name={memberName(hangout, uid)} size={54} />
                {uid === hangout.creatorID && (
                  <span className="crown" aria-label="Started it">
                    <Crown size={12} strokeWidth={2.5} />
                  </span>
                )}
              </span>
              <span className="t-cap w7 ellipsis" style={{ maxWidth: 62 }}>{uid === me.id ? 'You' : memberName(hangout, uid).split(' ')[0]}</span>
            </button>
          ))}
        </div>

        <ErrorBanner message={error} />

        {notices.length > 0 && (
          <section className="card stack gap-10" style={{ background: 'var(--lavender)' }}>
            <span className="label row gap-6"><Bell size={14} /> Reminders</span>
            <AnimatePresence initial={false}>
              {notices.slice(0, 5).map((n) => (
                <motion.div key={n.id} className="row gap-10" style={{ alignItems: 'flex-start' }} initial={{ opacity: 0, x: reduce ? 0 : -12 }} animate={{ opacity: 1, x: 0 }} transition={spring}>
                  <span className={`grow t-foot ${n.forUserID === me.id ? 'w8' : 'w6'}`}>{n.message}</span>
                  <span className="t-cap2 muted w7" style={{ whiteSpace: 'nowrap' }}>{timeFmt.format(n.createdAt)}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </section>
        )}

        {active && hasOpenCosts && <LiveSplitCard hangout={hangout} expenses={expenses} me={me.id} />}

        {myBills.length > 0 && (
          <section className="stack gap-12">
            <TwoToneTitle light="The" bold="bills" className="section-title" />
            <div className="list">
              <AnimatePresence initial={false}>
                {myBills.map((b) => (
                  <motion.div key={b.id} layout={!reduce} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={spring}>
                    <BillRow bill={b} me={me.id} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}

        <section className="stack gap-12">
          <TwoToneTitle light="All" bold="costs" className="section-title" />
          {expensesLoaded && expenses.length === 0 ? (
            <Empty>{active ? 'No costs yet. Tap + to add the first one.' : 'No costs were added.'}</Empty>
          ) : hangout.kind === 'tour' ? (
            groupByDay(expenses).map(([day, list]) => (
              <div key={day} className="stack gap-8">
                <DayHeader day={day} hangout={hangout} />
                <CostList hangout={hangout} expenses={list} me={me.id} onError={setError} />
              </div>
            ))
          ) : (
            <CostList hangout={hangout} expenses={expenses} me={me.id} onError={setError} />
          )}
          {active && expenses.length > 0 && <p className="t-cap muted w6 center">Swipe a cost left to delete it.</p>}
        </section>

        {active && isCreator && (
          <PillButton variant="dark" loading={ending} icon={<Flag size={20} />} onClick={() => setConfirmEnd(true)}>
            {hangout.kind === 'tour' ? 'End the tour' : 'End the hangout'}
          </PillButton>
        )}
      </main>

      <AddCostSheet open={adding} onClose={() => setAdding(false)} hangout={hangout} me={me.id} />
      <Confirm
        open={confirmEnd}
        title={`End ${hangout.title}?`}
        message="No one can add costs after this. Anyone who still owes gets a reminder here every 2 hours until they pay."
        action="End and create bills"
        destructive
        onConfirm={end}
        onCancel={() => setConfirmEnd(false)}
      />
    </>
  );
}

function HeaderCard({ hangout: h }: { hangout: Hangout }) {
  const [copied, setCopied] = useState(false);
  const active = h.status === 'active';
  const tokenValid = active && Date.now() < h.tokenExpiresAt.getTime();
  const link = `${location.origin}/join/${h.token}`;

  const share = async () => {
    const text = `Join "${h.title}" on SplitMate with token ${h.token}`;
    try {
      if (navigator.share) await navigator.share({ title: 'SplitMate', text, url: link });
      else {
        await navigator.clipboard.writeText(`${text}\n${link}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* share sheet dismissed */
    }
  };

  return (
    <section className="hero stack gap-14" style={{ padding: 22 }}>
      <span className="blob" style={{ width: 200, height: 200, right: -70, top: -90, background: 'rgba(255,255,255,0.08)' }} />
      <div className="row gap-8">
        <span className="chip kind">
          {h.kind === 'tour' ? <MapIcon size={12} /> : <Coffee size={12} />} {h.kind}
        </span>
        <span className="grow" />
        <span className="label" style={{ opacity: 0.9 }}>{active ? 'Live' : 'Ended'}</span>
      </div>
      <h1 className="heading" style={{ fontSize: 'var(--t-large)', textTransform: 'uppercase', lineHeight: 1.02, overflowWrap: 'anywhere' }}>{h.title}</h1>
      <div className="row gap-12" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="grow stack" style={{ minWidth: 130 }}>
          <span className="label" style={{ opacity: 0.85 }}>Total spent</span>
          <CountUp cents={h.totalSpentCents} className="t-large" style={{ lineHeight: 1.1 }} />
        </div>
        {tokenValid ? (
          <button onClick={share} className="stack" style={{ background: 'var(--white)', color: 'var(--ink)', borderRadius: 'var(--r-menu)', padding: '10px 14px', alignItems: 'center', gap: 2 }} aria-label={`Share token ${h.token}`}>
            <span className="row gap-6">
              <span className="mono t-title2" style={{ letterSpacing: '0.1em' }}>{h.token}</span>
              {copied ? <Check size={16} color="var(--sage)" /> : 'share' in navigator ? <Share2 size={16} color="var(--purple)" /> : <Copy size={16} color="var(--purple)" />}
            </span>
            <span className="t-cap2 muted w7">{copied ? 'Copied' : `valid until ${validFmt.format(h.tokenExpiresAt)}`}</span>
          </button>
        ) : (
          active && <span className="glass-tag">Token expired</span>
        )}
      </div>
    </section>
  );
}

function groupByDay(expenses: Expense[]): [string, Expense[]][] {
  const map = new Map<string, Expense[]>();
  for (const e of expenses) map.set(e.dayKey, [...(map.get(e.dayKey) ?? []), e]);
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

function DayHeader({ day, hangout }: { day: string; hangout: Hangout }) {
  const today = todayKey(hangout.timeZone);
  const settled = hangout.settledDays.includes(day);
  return (
    <div className="row gap-8" style={{ padding: '4px 4px 0' }}>
      <span className="grow label">{dayHeader(day)}</span>
      {settled ? (
        <span className="row gap-4 t-cap w8" style={{ color: 'var(--sage)' }}><CheckCircle2 size={13} /> Settled</span>
      ) : day === today ? (
        <span className="row gap-4 t-cap w8" style={{ color: 'var(--purple)' }}><Clock size={13} /> Today</span>
      ) : (
        <span className="row gap-4 t-cap w8 muted"><Clock size={13} /> Closing</span>
      )}
    </div>
  );
}

function CostList({ hangout, expenses, me, onError }: { hangout: Hangout; expenses: Expense[]; me: string; onError: (m: string | null) => void }) {
  const { reduce, spring } = useMotion();
  return (
    <div className="list">
      <AnimatePresence initial={false}>
        {expenses.map((e) => {
          const canDelete = hangout.status === 'active' && !hangout.settledDays.includes(e.dayKey);
          return (
            <motion.div key={e.id} layout={!reduce} initial={{ opacity: 0, y: reduce ? 0 : -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={spring}>
              <SwipeRow enabled={canDelete} actionLabel="Delete" actionIcon={<Trash2 size={18} />} onAction={async () => onError(await deleteExpense(hangout, e))}>
                <ExpenseRow hangout={hangout} expense={e} me={me} />
              </SwipeRow>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function ExpenseRow({ hangout, expense: e, me }: { hangout: Hangout; expense: Expense; me: string }) {
  const myShare = shareOf(e, me);
  const payer = e.paidByID === me ? 'You' : e.paidByName;
  return (
    <div className="list-row">
      <Link to={e.paidByID === me ? '/profile' : `/member/${e.paidByID}`} aria-label={payer} onPointerDown={(ev) => ev.stopPropagation()}>
        <Avatar avatar={memberAvatar(hangout, e.paidByID)} name={e.paidByName} size={42} />
      </Link>
      <div className="grow">
        <div className="w8 ellipsis">{e.title}</div>
        <div className="t-foot muted w6 ellipsis">
          {payer} paid · split {e.splitAmongIDs.length} {e.splitAmongIDs.length === 1 ? 'way' : 'ways'}
        </div>
      </div>
      <div className="stack" style={{ alignItems: 'flex-end' }}>
        <span className="num t-callout">{formatTaka(e.amountCents)}</span>
        {myShare > 0 && <span className="t-cap2 w7" style={{ color: 'var(--purple)' }}>your share {formatTaka(myShare)}</span>}
      </div>
    </div>
  );
}
