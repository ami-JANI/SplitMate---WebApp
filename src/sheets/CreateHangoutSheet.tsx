import { Minus, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet } from '../components/Sheet';
import { Avatar, ErrorBanner, Segmented, Switch } from '../components/ui';
import { createHangout } from '../data/actions';
import { useMe } from '../data/auth';
import { useFriends } from '../data/hooks';
import { useMotion } from '../lib/motion';
import type { HangoutKind } from '../lib/types';
import { MAX_TOUR_DAYS } from '../lib/validator';

export function CreateHangoutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMe();
  const friends = useFriends(me.friendIDs);
  const navigate = useNavigate();
  const { spring } = useMotion();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<HangoutKind>('hangout');
  const [days, setDays] = useState(3);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle('');
      setKind('hangout');
      setDays(3);
      setPicked(new Set());
      setError(null);
    }
  }, [open]);

  const create = async () => {
    setBusy(true);
    const res = await createHangout({ title, kind, days, creator: me, friends: (friends ?? []).filter((f) => picked.has(f.id)) });
    setBusy(false);
    if (res.error) return setError(res.error);
    onClose();
    if (res.id) navigate(`/hangout/${res.id}`);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={kind === 'tour' ? 'New tour' : 'New hangout'}
      left={<button className="text-btn" onClick={onClose}>Cancel</button>}
      right={<button className="text-btn" onClick={create} disabled={busy}>{busy ? 'Creating…' : 'Create'}</button>}
    >
      <div>
        <div className="form-label">Name</div>
        <div className="form-group">
          <label className="form-row">
            <span className="sr-only">Name</span>
            <input placeholder="e.g. Friday dinner" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} autoFocus onKeyDown={(e) => e.key === 'Enter' && create()} />
          </label>
        </div>
      </div>

      <div>
        <div className="form-label">Type</div>
        <div className="form-group">
          <div className="form-row" style={{ padding: 10 }}>
            <div className="grow">
              <Segmented value={kind} onChange={setKind} options={[{ value: 'hangout', label: 'Hangout' }, { value: 'tour', label: 'Tour' }]} />
            </div>
          </div>
          <AnimatePresence initial={false}>
            {kind === 'tour' && (
              <motion.div key="days" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring} style={{ overflow: 'hidden' }}>
                <div className="form-row">
                  <span className="grow w6">Lasts {days} days</span>
                  <div className="stepper">
                    <button type="button" aria-label="One day less" disabled={days <= 2} onClick={() => setDays((d) => Math.max(2, d - 1))}><Minus size={16} /></button>
                    <button type="button" aria-label="One day more" disabled={days >= MAX_TOUR_DAYS} onClick={() => setDays((d) => Math.min(MAX_TOUR_DAYS, d + 1))}><Plus size={16} /></button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <p className="form-foot">
          {kind === 'tour'
            ? "A tour settles each day's costs at the end of that day. Its token works until the last day."
            : "A hangout's join token works for 1 day. Need longer? Make it a tour."}
        </p>
      </div>

      {friends && friends.length > 0 && (
        <div>
          <div className="form-label">Add friends now (optional)</div>
          <div className="form-group">
            {friends.map((f) => (
              <label key={f.id} className="form-row" style={{ padding: '8px 16px' }}>
                <Avatar avatar={f.avatar} name={f.name} size={36} />
                <span className="grow">
                  <span className="w7 ellipsis" style={{ display: 'block' }}>{f.name}</span>
                  <span className="t-foot muted">@{f.username}</span>
                </span>
                <Switch
                  label={`Add ${f.name}`}
                  checked={picked.has(f.id)}
                  onChange={(on) =>
                    setPicked((p) => {
                      const n = new Set(p);
                      if (on) n.add(f.id);
                      else n.delete(f.id);
                      return n;
                    })
                  }
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <ErrorBanner message={error} />
    </Sheet>
  );
}
