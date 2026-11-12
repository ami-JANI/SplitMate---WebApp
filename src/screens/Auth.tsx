import { ArrowRight, AtSign, KeyRound, Mail, MailCheck, Plus, User, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AvatarPicker } from '../components/AvatarPicker';
import { Sheet } from '../components/Sheet';
import { ErrorBanner, PasswordField, PillButton, PillField, TwoToneTitle } from '../components/ui';
import { useAuth } from '../data/auth';
import { useMotion } from '../lib/motion';
import { emailProblem, looksLikeEmail, MIN_PASSWORD } from '../lib/validator';

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
  const { signIn } = useAuth();
  const { rise } = useMotion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(await signIn(email, password));
    setBusy(false);
  };

  return (
    <main className="screen" style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 'calc(var(--safe-top) + 24px)' }}>
      <motion.div {...rise(0)}><Hero /></motion.div>
      <motion.form className="stack gap-14" onSubmit={submit} noValidate {...rise(0.05)}>
        <TwoToneTitle as="h2" light="Welcome" bold="back" size="var(--t-title)" />
        <PillField icon={<User size={20} />} type="text" placeholder="Email or username" aria-label="Email or username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordField placeholder="Password" aria-label="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <ErrorBanner message={error} />
        <PillButton type="submit" loading={busy} icon={<ArrowRight size={20} />}>Sign in</PillButton>
        <button type="button" className="text-btn t-sub" onClick={() => setForgotOpen(true)} style={{ alignSelf: 'center' }}>Forgot password?</button>
        <p className="center muted w6 t-sub">
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </motion.form>
      <ForgotPasswordSheet open={forgotOpen} onClose={() => setForgotOpen(false)} typed={email} />
    </main>
  );
}

/** Asks for the account's email and sends a Firebase reset link to it. */
function ForgotPasswordSheet({ open, onClose, typed }: { open: boolean; onClose: () => void; typed: string }) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const typedUsername = typed.trim() !== '' && !looksLikeEmail(typed);

  useEffect(() => {
    if (!open) return;
    // Usernames never reveal an email, so a username has to be swapped for the email by hand.
    setEmail(looksLikeEmail(typed) ? typed.trim() : '');
    setError(null);
    setSentTo(null);
  }, [open, typed]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const problem = emailProblem(email);
    if (problem) return setError(problem);
    setBusy(true);
    const failed = await resetPassword(email);
    setBusy(false);
    if (failed) return setError(failed);
    setError(null);
    setSentTo(email.trim());
  };

  return (
    <Sheet open={open} onClose={onClose} label="Reset your password" left={<button type="button" className="text-btn" onClick={onClose}>{sentTo ? 'Done' : 'Cancel'}</button>}>
      {sentTo ? (
        <div className="stack gap-16" style={{ minHeight: '36dvh' }} role="status">
          <MailCheck size={40} color="var(--purple)" />
          <TwoToneTitle as="h2" light="Check your" bold="inbox" size="var(--t-large)" />
          <p className="muted w6">
            If <b style={{ color: "var(--ink)" }}>{sentTo}</b> has a SplitMate account, a reset link is on its way. Open it, pick a new password, then sign in.
          </p>
          <p className="muted w6 t-sub">Nothing after a few minutes? Check spam, or make sure it's the email you signed up with.</p>
          <PillButton type="button" onClick={onClose} icon={<ArrowRight size={20} />}>Back to sign in</PillButton>
          <button type="button" className="text-btn t-sub" style={{ alignSelf: 'center' }} onClick={() => setSentTo(null)}>Use a different email</button>
        </div>
      ) : (
        <form className="stack gap-16" onSubmit={send} noValidate style={{ minHeight: '36dvh' }}>
          <TwoToneTitle as="h2" light="Reset your" bold="password" size="var(--t-large)" />
          <p className="muted w6">
            {typedUsername
              ? `For privacy we don't look up emails from usernames. Type the email you used to create @${typed.trim().replace(/^@/, '')}.`
              : "Type the email you signed up with and we'll send you a link to choose a new password."}
          </p>
          <PillField icon={<Mail size={20} />} type="email" placeholder="Email" aria-label="Email" autoComplete="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          <ErrorBanner message={error} />
          <PillButton type="submit" loading={busy} icon={<Mail size={20} />}>Send reset link</PillButton>
        </form>
      )}
    </Sheet>
  );
}

/**
 * Opened from the reset email (/auth/action?mode=resetPassword&oobCode=...).
 * Checks the link, takes the new password, and signs in.
 */
export function ResetPassword() {
  const { checkResetLink, finishReset } = useAuth();
  const { rise } = useMotion();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const code = params.get('oobCode') ?? '';
  const mode = params.get('mode');
  const [email, setEmail] = useState<string | null>(null);
  const [linkProblem, setLinkProblem] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== 'resetPassword' || !code) {
      setLinkProblem("This link isn't a password reset link.");
      return;
    }
    let live = true;
    void checkResetLink(code).then((r) => {
      if (!live) return;
      if ('email' in r) setEmail(r.email);
      else setLinkProblem(r.problem);
    });
    return () => {
      live = false;
    };
  }, [code, mode]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;
    if (password.length < MIN_PASSWORD) return setError(`Password needs at least ${MIN_PASSWORD} characters`);
    if (password !== again) return setError("The two passwords don't match");
    setBusy(true);
    const problem = await finishReset(code, email, password);
    setBusy(false);
    if (problem) return setError(problem);
    navigate('/', { replace: true });
  };

  return (
    <main className="screen" style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 'calc(var(--safe-top) + 24px)' }}>
      <motion.div {...rise(0)}><Hero /></motion.div>
      <motion.form className="stack gap-14" onSubmit={submit} noValidate {...rise(0.05)}>
        <TwoToneTitle as="h2" light="New" bold="password" size="var(--t-title)" />
        {linkProblem ? (
          <>
            <ErrorBanner message={linkProblem} />
            <PillButton type="button" onClick={() => navigate('/', { replace: true })} icon={<ArrowRight size={20} />}>Back to sign in</PillButton>
          </>
        ) : !email ? (
          <p className="muted w6" role="status">Checking your link…</p>
        ) : (
          <>
            <p className="muted w6">Choose a new password for <b style={{ color: "var(--ink)" }}>{email}</b>. Use at least {MIN_PASSWORD} characters.</p>
            <PasswordField placeholder="New password" aria-label="New password" autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
            <PasswordField placeholder="Type it again" aria-label="Confirm new password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
            <ErrorBanner message={error} />
            <PillButton type="submit" loading={busy} icon={<KeyRound size={20} />}>Save and sign in</PillButton>
          </>
        )}
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
            <PillField icon={<Mail size={20} />} type="email" placeholder="Email" aria-label="Email" autoComplete="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} />
            <PasswordField placeholder={`Password (${MIN_PASSWORD}+ characters)`} aria-label="Password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
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
