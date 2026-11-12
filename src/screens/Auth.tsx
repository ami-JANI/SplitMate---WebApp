import { ArrowRight, AtSign, Lock, Mail, Plus, User, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AvatarPicker } from '../components/AvatarPicker';
import { ErrorBanner, PillButton, PillField, TwoToneTitle } from '../components/ui';
import { useAuth } from '../data/auth';
import { useMotion } from '../lib/motion';

function Hero() {
  return (
    <div className="hero" style={{ minHeight: 200, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 6 }}>
      <span className="blob" style={{ width: 180, height: 180, right: -50, top: -60, background: 'rgba(255,255,255,0.08)' }} />
      <span className="blob" style={{ width: 120, height: 120, right: 30, bottom: -60, background: 'rgba(255,194,51,0.25)' }} />
      <Users size={34} color="var(--yellow)" fill="var(--yellow)" style={{ marginBottom: 'auto' }} />
      <TwoToneTitle as="h1" light="Split" bold="Mate" size="2.75rem" />
      <p className="w6" style={{ opacity: 0.9 }}>Hang out. Split fair. Settle up.</p>
    </div>
  );
}

export function SignIn() {
  const { signIn, resetPassword } = useAuth();
  const { rise } = useMotion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setInfo(null);
    setError(await signIn(email, password));
    setBusy(false);
  };

  const forgot = async () => {
    setError(null);
    const problem = await resetPassword(email);
    if (problem) setError(problem);
    else setInfo(`If ${email.trim()} has an account, a reset link is on its way.`);
  };

  return (
    <main className="screen" style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 'calc(var(--safe-top) + 24px)' }}>
      <motion.div {...rise(0)}><Hero /></motion.div>
      <motion.form className="stack gap-14" onSubmit={submit} noValidate {...rise(0.05)}>
        <TwoToneTitle as="h2" light="Welcome" bold="back" size="var(--t-title)" />
        <PillField icon={<Mail size={20} />} type="email" placeholder="Email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <PillField icon={<Lock size={20} />} type="password" placeholder="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <ErrorBanner message={error} />
        {info && <div className="info-banner" role="status">{info}</div>}
        <PillButton type="submit" loading={busy} icon={<ArrowRight size={20} />}>Sign in</PillButton>
        <button type="button" className="text-btn t-sub" onClick={forgot} style={{ alignSelf: 'center' }}>Forgot password?</button>
        <p className="center muted w6 t-sub">
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </motion.form>
    </main>
  );
}

/** Sign up, or (complete = true) finish a profile for an account that has none yet. */
export function SignUp({ complete = false }: { complete?: boolean }) {
  const { signUp, completeProfile, signOut } = useAuth();
  const { rise } = useMotion();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(complete ? await completeProfile({ name, username, avatar }) : await signUp({ name, username, email, password, avatar }));
    setBusy(false);
  };

  return (
    <main className="screen" style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 'calc(var(--safe-top) + 24px)' }}>
      <motion.form className="stack gap-14" onSubmit={submit} noValidate {...rise(0)}>
        <TwoToneTitle as="h1" light={complete ? 'Finish' : 'Join the'} bold={complete ? 'setup' : 'crew'} size="var(--t-large)" />
        <p className="muted w6">Friends find you by your username, so pick one you like.</p>
        <div className="card" style={{ padding: 18 }}>
          <AvatarPicker value={avatar} onChange={setAvatar} />
        </div>
        <PillField icon={<User size={20} />} placeholder="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        <PillField icon={<AtSign size={20} />} placeholder="Username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value.replace(/^@/, ''))} />
        {!complete && (
          <>
            <PillField icon={<Mail size={20} />} type="email" placeholder="Email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <PillField icon={<Lock size={20} />} type="password" placeholder="Password (6+ characters)" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </>
        )}
        <ErrorBanner message={error} />
        <PillButton type="submit" loading={busy} icon={<Plus size={20} />}>{complete ? 'Save profile' : 'Create account'}</PillButton>
        {complete ? (
          <button type="button" className="text-btn" onClick={() => signOut()}>Sign out</button>
        ) : (
          <p className="center muted w6 t-sub">
            Already have an account? <Link to="/">Sign in</Link>
          </p>
        )}
      </motion.form>
    </main>
  );
}
