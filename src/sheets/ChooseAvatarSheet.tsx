import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AvatarPicker } from '../components/AvatarPicker';
import { Sheet } from '../components/Sheet';
import { ErrorBanner, PillButton, TwoToneTitle } from '../components/ui';
import { updateAvatar } from '../data/actions';
import { useAppData } from '../data/appData';
import { useMe } from '../data/auth';

export function ChooseAvatarSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMe();
  const { hangouts } = useAppData();
  const [value, setValue] = useState(me.avatar);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(me.avatar);
      setError(null);
    }
  }, [open, me.avatar]);

  const save = async () => {
    if (!value) return setError('Pick an avatar first');
    setBusy(true);
    const problem = await updateAvatar(me, value, hangouts);
    setBusy(false);
    if (problem) return setError(problem);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} label="Choose avatar" left={<button className="text-btn" onClick={onClose}>Cancel</button>}>
      <TwoToneTitle light="Pick your" bold="look" size="var(--t-title)" />
      <p className="muted w6">Your avatar shows next to your name in hangouts, bills and friend lists.</p>
      <div className="card" style={{ padding: 18 }}>
        <AvatarPicker value={value} onChange={setValue} />
      </div>
      <ErrorBanner message={error} />
      <PillButton loading={busy} onClick={save} icon={<Check size={20} />}>Use this avatar</PillButton>
    </Sheet>
  );
}
