import { motion } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { DataProvider } from './data/appData';
import { AuthProvider, useAuth } from './data/auth';
import { isConfigured } from './firebase';
import { useMotion } from './lib/motion';
import { ResetPassword, SignIn, SignUp } from './screens/Auth';
import { HangoutScreen } from './screens/HangoutScreen';
import { Home } from './screens/Home';
import { FindFriends, MemberProfile, MyProfile } from './screens/Profile';
import { JoinSheet } from './sheets/JoinSheet';

export default function App() {
  if (!isConfigured) return <NotConfigured />;
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="app-shell">
          <Gate />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

/** Signed out → sign in / sign up. Signed in without a profile → finish setup. Otherwise the app. */
function Gate() {
  const { user, profile } = useAuth();
  const { pathname } = useLocation();
  // The reset link from the email works whether or not someone is signed in here.
  if (pathname === '/auth/action') return <Page><ResetPassword /></Page>;
  if (user === undefined || (user && profile === undefined)) return <div className="loading-screen" aria-label="Loading"><span className="spinner" style={{ color: 'var(--purple)', borderColor: 'var(--lavender)', borderTopColor: 'var(--purple)', width: 34, height: 34 }} /></div>;
  if (!user) {
    return (
      <Routes>
        <Route path="/signup" element={<Page><SignUp /></Page>} />
        <Route path="*" element={<Page><SignIn /></Page>} />
      </Routes>
    );
  }
  if (!profile) return <SignUp complete />;
  return (
    <DataProvider uid={profile.id}>
      <SignedInRoutes />
    </DataProvider>
  );
}

function SignedInRoutes() {
  const location = useLocation();
  return (
    <Routes location={location}>
      <Route path="/" element={<Home />} />
      <Route path="/join/:token" element={<JoinFromLink />} />
      <Route path="/hangout/:id" element={<Page key={location.pathname}><HangoutScreen /></Page>} />
      <Route path="/profile" element={<Page><MyProfile /></Page>} />
      <Route path="/member/:id" element={<Page key={location.pathname}><MemberProfile /></Page>} />
      <Route path="/friends" element={<Page><FindFriends /></Page>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/** A pushed screen slides in a little from the right. */
function Page({ children }: { children: ReactNode }) {
  const { reduce, spring } = useMotion();
  return (
    <motion.div initial={reduce ? { opacity: 0 } : { opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} transition={spring}>
      {children}
    </motion.div>
  );
}

/** /join/K7P2QX opens home with the join sheet filled in. */
function JoinFromLink() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (!open) navigate('/', { replace: true });
  }, [open, navigate]);
  return (
    <>
      <Home />
      <JoinSheet open={open} onClose={() => setOpen(false)} initialToken={token} />
    </>
  );
}

function NotConfigured() {
  return (
    <main className="screen">
      <div className="card config-warning stack gap-8">
        <h1 className="heading t-title2">Firebase isn't set up yet</h1>
        <p className="t-sub">
          Copy <code>.env.example</code> to <code>.env.local</code> and fill in the web app config from the Firebase console, or set <code>VITE_USE_EMULATORS=true</code> and run <code>npm run emulators</code>.
        </p>
      </div>
    </main>
  );
}
