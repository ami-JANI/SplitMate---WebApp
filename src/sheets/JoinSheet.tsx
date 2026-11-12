import { ArrowRight } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet } from '../components/Sheet';
import { ErrorBanner, PillButton, TwoToneTitle } from '../components/ui';
import { joinHangout } from '../data/actions';
import { useAppData } from '../data/appData';
import { useMe } from '../data/auth';
import { TOKEN_ALPHABET, TOKEN_LENGTH } from '../lib/token';

export function JoinSheet({ open, onClose, initialToken = '' }: { open: boolean; onClose: () => void; initialToken?: string }) {
  const me = useMe();
  const { hangouts } = useAppData();
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setToken(initialToken.toUpperCase().slice(0, TOKEN_LENGTH));
      setError(null);
    }
  }, [open, initialToken]);

  const join = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    const res = await joinHangout(token, me, hangouts);
    setBusy(false);
    if (res.error) return setError(res.error);
    onClose();
    navigate(`/hangout/${res.id}`);
  };

  return (
    <Sheet open={open} onClose={onClose} label="Join with a token" left={<button className="text-btn" onClick={onClose}>Cancel</button>}>
      <form className="stack gap-16" onSubmit={join} style={{ minHeight: '42dvh' }}>
        <TwoToneTitle as="h2" light="Enter the" bold="token" size="var(--t-large)" />
        <p className="muted w6">
          Ask whoever started the hangout for its token. Hangout tokens last one day; tour tokens last until the tour's final day.
        </p>
        <input
          className="mono"
          aria-label="Token"
          value={token}
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="K7P2QX"
          maxLength={TOKEN_LENGTH}
          onChange={(e) => {
            const allowed = new RegExp(`[^${TOKEN_ALPHABET}]`, 'g');
            setToken(e.target.value.toUpperCase().replace(allowed, '').slice(0, TOKEN_LENGTH));
          }}
          style={{
            width: '100%', textAlign: 'center', fontSize: '2.25rem', padding: '18px 8px', border: 0, outline: 0,
            borderRadius: 'var(--r-card)', background: 'var(--paper)', boxShadow: 'var(--soft-shadow)', letterSpacing: '0.18em',
          }}
        />
        <ErrorBanner message={error} />
        <PillButton type="submit" loading={busy} icon={<ArrowRight size={20} />}>Join</PillButton>
      </form>
    </Sheet>
  );
}
