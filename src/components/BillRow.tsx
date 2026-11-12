import { ArrowRight, Check, Send } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { confirmReceived, markInProgress } from '../data/actions';
import { dayHeader } from '../lib/dayKey';
import { firstName } from '../lib/avatars';
import { formatTaka } from '../lib/money';
import { useMotion } from '../lib/motion';
import type { Bill } from '../lib/types';
import { Avatar, ErrorBanner, PressButton, StageTracker, StatusChip } from './ui';

/** "You" for the viewer, the name for everyone else. */
export const who = (id: string, name: string, me: string, lower = false) => (id === me ? (lower ? 'you' : 'You') : firstName(name));

/** One bill with its stage and the action for whoever acts next (docs/HANDOFF.md §3.9). */
export function BillRow({ bill, me, tracker = true, showHangout = false }: { bill: Bill; me: string; tracker?: boolean; showHangout?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { reduce } = useMotion();
  const mine = bill.fromID === me && bill.status !== 'delivered';

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    setError(await fn());
    setBusy(false);
  };

  let action: { key: string; node: React.ReactNode } | null = null;
  if (bill.status !== 'delivered') {
    if (bill.toID === me) {
      action = {
        key: 'confirm',
        node: (
          <PressButton className="small-btn sage" disabled={busy} onClick={() => run(() => confirmReceived(bill, me))}>
            <Check size={16} strokeWidth={3} /> Confirm received
          </PressButton>
        ),
      };
    } else if (bill.fromID === me && bill.status === 'due') {
      action = {
        key: 'paid',
        node: (
          <PressButton className="small-btn" disabled={busy} onClick={() => run(() => markInProgress(bill, me))}>
            <Send size={16} strokeWidth={2.5} /> I've paid it
          </PressButton>
        ),
      };
    } else if (bill.fromID === me && bill.status === 'inProgress') {
      action = { key: 'wait', node: <p className="t-foot muted w7 center">Waiting for {firstName(bill.toName)} to confirm</p> };
    }
  }

  return (
    <div className="card stack gap-12" style={{ background: mine ? 'color-mix(in srgb, var(--light-yellow) 50%, var(--paper))' : undefined }}>
      <div className="row gap-10">
        <div className="row" style={{ gap: 4 }}>
          <Avatar avatar={bill.fromAvatar} name={bill.fromName} size={34} />
          <ArrowRight size={14} className="muted" />
          <Avatar avatar={bill.toAvatar} name={bill.toName} size={34} />
        </div>
        <div className="grow">
          <div className="w8 t-sub ellipsis">
            {who(bill.fromID, bill.fromName, me)} → {who(bill.toID, bill.toName, me)}
          </div>
          {(showHangout || bill.dayKey) && (
            <div className="t-cap muted w7 ellipsis">
              {[showHangout ? bill.hangoutTitle : null, bill.dayKey ? dayHeader(bill.dayKey) : null].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
          <span className="num t-title3">{formatTaka(bill.amountCents)}</span>
          <StatusChip status={bill.status} />
        </div>
      </div>
      {tracker && <StageTracker status={bill.status} />}
      <AnimatePresence mode="wait" initial={false}>
        {action && (
          <motion.div key={action.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0.2 : 0.15 }}>
            {action.node}
          </motion.div>
        )}
      </AnimatePresence>
      <ErrorBanner message={error} />
    </div>
  );
}
