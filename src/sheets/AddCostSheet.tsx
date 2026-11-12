import { Banknote, Check, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Sheet } from '../components/Sheet';
import { Avatar, ErrorBanner } from '../components/ui';
import { addExpense } from '../data/actions';
import { formatTaka, parseTaka } from '../lib/money';
import { memberAvatar, memberName, type Hangout } from '../lib/types';

/** Add a cost: what, how much, who paid, and who shares it (docs/HANDOFF.md §3.8). */
export function AddCostSheet({ open, onClose, hangout, me }: { open: boolean; onClose: () => void; hangout: Hangout; me: string }) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(me);
  const [all, setAll] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(new Set([me]));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle('');
      setAmount('');
      setPaidBy(me);
      setAll(true);
      setPicked(new Set([me]));
      setError(null);
    }
  }, [open, me]);

  const members = hangout.memberIDs;
  const split = all ? members : members.filter((id) => picked.has(id));
  const cents = parseTaka(amount);

  let footer = 'Pick at least one person';
  if (split.length > 0) {
    footer = cents && cents > 0 ? `${formatTaka(Math.round(cents / split.length))} each for ${split.length} ${split.length === 1 ? 'person' : 'people'}` : `Split between ${split.length} ${split.length === 1 ? 'person' : 'people'}`;
  }

  const save = async () => {
    setBusy(true);
    const problem = await addExpense(hangout, { title, amountCents: cents, paidByID: paidBy, splitAmongIDs: split });
    setBusy(false);
    if (problem) return setError(problem);
    onClose();
  };

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const label = (id: string) => (id === me ? 'You' : memberName(hangout, id));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add a cost"
      left={<button className="text-btn" onClick={onClose}>Cancel</button>}
      right={<button className="text-btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>}
    >
      <div>
        <div className="form-label">What was it?</div>
        <div className="form-group">
          <label className="form-row">
            <span className="sr-only">Title</span>
            <input placeholder="e.g. Dinner at Jhau Bon" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </label>
          <label className="form-row">
            <Banknote size={20} color="var(--sage)" />
            <span className="sr-only">Amount in taka</span>
            <input inputMode="decimal" placeholder="Amount (৳)" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))} />
          </label>
        </div>
      </div>

      <div>
        <div className="form-label">Who paid?</div>
        <div className="form-group">
          <label className="form-row">
            <span className="grow w6">Paid by</span>
            <select
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              style={{ border: 0, background: 'transparent', font: 'inherit', color: 'var(--muted-ink)', fontWeight: 700, textAlign: 'right', maxWidth: '60%' }}
            >
              {members.map((id) => (
                <option key={id} value={id}>{label(id)}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div>
        <div className="form-label">Split equally between</div>
        <div className="form-group">
          <RadioRow on={all} onClick={() => setAll((a) => !a)} icon={<Users size={18} color="var(--purple)" />}>
            All {members.length} members
          </RadioRow>
          {members.map((id) => (
            <motion.div key={id} animate={{ opacity: all ? 0.35 : 1 }} transition={{ duration: 0.2 }}>
              <RadioRow on={all || picked.has(id)} disabled={all} onClick={() => toggle(id)} icon={<Avatar avatar={memberAvatar(hangout, id)} name={memberName(hangout, id)} size={30} />}>
                {label(id)}
              </RadioRow>
            </motion.div>
          ))}
        </div>
        <p className="form-foot">{footer}</p>
      </div>

      <ErrorBanner message={error} />
    </Sheet>
  );
}

function RadioRow({ on, onClick, icon, children, disabled }: { on: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} className="form-row" style={{ width: '100%', textAlign: 'left' }} onClick={onClick} disabled={disabled}>
      {icon}
      <span className="grow w6">{children}</span>
      <span
        style={{
          width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center',
          background: on ? 'var(--purple)' : 'transparent', border: on ? 0 : '2px solid var(--sand)', color: 'var(--white)',
        }}
      >
        {on && <Check size={16} strokeWidth={3} />}
      </span>
    </button>
  );
}
