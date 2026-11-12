import { AlertCircle, ArrowLeftRight, BadgeCheck, ChevronLeft, Clock, Eye, EyeOff, Lock } from 'lucide-react';
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { avatarSrc, initials, initialsColor, isAvatar } from '../lib/avatars';
import { formatTaka } from '../lib/money';
import { useMotion } from '../lib/motion';
import { billStatusTitle, type BillStatus } from '../lib/types';

/** "PAST HANGOUTS" with a light first word and a bold rest. */
export function TwoToneTitle({ light, bold, size = 'var(--t-title2)', color, as: Tag = 'h2', className = '' }: {
  light: string;
  bold: string;
  size?: string;
  color?: string;
  as?: 'h1' | 'h2' | 'h3' | 'span';
  className?: string;
}) {
  return (
    <Tag className={`two-tone ${className}`} style={{ fontSize: size, color, display: 'block' }}>
      <span className="light">{light}</span> <span className="bold">{bold}</span>
    </Tag>
  );
}

type MotionButtonProps = ComponentProps<typeof motion.button>;

/** A button that shrinks to 0.96 while pressed (or just works, with reduced motion). */
export function PressButton(props: MotionButtonProps) {
  const { press } = useMotion();
  return <motion.button type="button" {...press} {...props} />;
}

export function PillButton({ children, icon, loading, variant, className = '', ...rest }: MotionButtonProps & {
  icon?: ReactNode;
  loading?: boolean;
  variant?: 'dark' | 'sage' | 'plain' | 'danger';
}) {
  return (
    <PressButton className={`pill-btn ${variant ?? ''} ${className}`} disabled={loading || rest.disabled} {...rest}>
      <span>{children as ReactNode}</span>
      {loading ? <span className="spinner" aria-label="Working" /> : icon}
    </PressButton>
  );
}

export function CircleButton({ className = '', ...rest }: MotionButtonProps) {
  return <PressButton className={`circle-btn ${className}`} {...rest} />;
}

export function PillField({ icon, ...rest }: ComponentProps<'input'> & { icon: ReactNode }) {
  return (
    <label className="pill-field">
      {icon}
      <input {...rest} />
    </label>
  );
}

/** A password pill with an eye button that shows or hides what was typed. */
export function PasswordField(props: Omit<ComponentProps<'input'>, 'type'>) {
  const [shown, setShown] = useState(false);
  return (
    <label className="pill-field">
      <Lock size={20} />
      <input {...props} type={shown ? 'text' : 'password'} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      <button
        type="button"
        className="eye-btn"
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
        // Keep the keyboard up and the cursor in the field on phones.
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => setShown((v) => !v)}
      >
        {shown ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </label>
  );
}

export function ErrorBanner({ message }: { message: string | null | undefined }) {
  const { spring } = useMotion();
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.div
          key="err"
          role="alert"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={spring}
          style={{ overflow: 'hidden' }}
        >
          <div className="error-banner">
            <AlertCircle size={18} />
            <span>{message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** An avatar SVG, or initials on a colour picked from the name. */
export function Avatar({ avatar, name, size = 44, ring = true }: { avatar?: string; name: string; size?: number; ring?: boolean }) {
  const style = { width: size, height: size, boxShadow: ring ? undefined : 'none' };
  if (isAvatar(avatar)) {
    return (
      <span className="avatar" style={style}>
        <img src={avatarSrc(avatar)} alt="" width={size} height={size} draggable={false} />
      </span>
    );
  }
  return (
    <span className="avatar" style={{ ...style, background: initialsColor(name), fontSize: size * 0.38 }} aria-hidden>
      {initials(name)}
    </span>
  );
}

const chipIcon: Record<BillStatus, ReactNode> = {
  due: <Clock size={12} strokeWidth={3} />,
  inProgress: <ArrowLeftRight size={12} strokeWidth={3} />,
  delivered: <BadgeCheck size={12} strokeWidth={3} />,
};

export function StatusChip({ status }: { status: BillStatus }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={status}
        className={`chip ${status}`}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={reduce ? { duration: 0.2 } : { type: 'spring', stiffness: 500, damping: 31 }}
      >
        {chipIcon[status]}
        {billStatusTitle[status]}
      </motion.span>
    </AnimatePresence>
  );
}

const STAGES: BillStatus[] = ['due', 'inProgress', 'delivered'];

/** Three dots joined by lines: Due, In progress, Delivered. */
export function StageTracker({ status }: { status: BillStatus }) {
  const { spring } = useMotion();
  const stage = STAGES.indexOf(status);
  return (
    <div aria-label={`Stage: ${billStatusTitle[status]}`}>
      <div className="tracker">
        {STAGES.map((s, i) => (
          <StageBits key={s} i={i} stage={stage} spring={spring} />
        ))}
      </div>
      <div className="tracker-labels">
        {STAGES.map((s, i) => (
          <span key={s} className={i <= stage ? 'on' : ''}>
            {billStatusTitle[s]}
          </span>
        ))}
      </div>
    </div>
  );
}

function StageBits({ i, stage, spring }: { i: number; stage: number; spring: object }) {
  return (
    <>
      <motion.span
        className="tracker-dot"
        animate={{ backgroundColor: i <= stage ? '#946BCC' : '#E8E0CC', scale: i === stage ? 1.15 : 1 }}
        transition={spring}
      />
      {i < 2 && (
        <span className="tracker-line">
          <motion.span className="tracker-fill" initial={false} animate={{ scaleX: i < stage ? 1 : 0 }} transition={spring} />
        </span>
      )}
    </>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <span className="switch">
      <input type="checkbox" role="switch" checked={checked} aria-label={label} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
      <span className="thumb" />
    </span>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const id = useId();
  const { snappy } = useMotion();
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}>
          {value === o.value && <motion.span layoutId={`seg-${id}`} className="seg-thumb" transition={snappy} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Pushed-screen title bar with a back button. */
export function TopBar({ title, right }: { title: string; right?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="top-bar">
      <button className="circle-btn" aria-label="Back" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/'))}>
        <ChevronLeft size={26} />
      </button>
      <div className="title ellipsis">{title}</div>
      <div style={{ justifySelf: 'end' }}>{right}</div>
    </header>
  );
}

/** Money that counts up/down to its new value (iOS numericText). */
export function CountUp({ cents, className = '', style }: { cents: number; className?: string; style?: React.CSSProperties }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(cents);
  const from = useRef(cents);
  useEffect(() => {
    if (reduce || from.current === cents) {
      from.current = cents;
      setShown(cents);
      return;
    }
    const controls = animate(from.current, cents, {
      duration: 0.6,
      ease: 'easeOut',
      onUpdate: (v) => setShown(Math.round(v)),
    });
    from.current = cents;
    return () => controls.stop();
  }, [cents, reduce]);
  return (
    <span className={`num ${className}`} style={style} aria-label={formatTaka(cents)}>
      {formatTaka(shown)}
    </span>
  );
}

export function Empty({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="empty card">
      {icon}
      <div>{children}</div>
    </div>
  );
}

/**
 * Swipe a row left to reveal a delete action. On desktop (no touch) the action
 * also shows when the row is focused or hovered via the visible button.
 */
export function SwipeRow({ children, onAction, actionLabel, actionIcon, enabled = true }: {
  children: ReactNode;
  onAction: () => void;
  actionLabel: string;
  actionIcon: ReactNode;
  enabled?: boolean;
}) {
  const x = useMotionValue(0);
  const reduce = useReducedMotion();
  if (!enabled) return <>{children}</>;
  return (
    <div className="swipe">
      <button className="swipe-action" onClick={onAction} aria-label={actionLabel} tabIndex={-1}>
        {actionIcon}
        {actionLabel}
      </button>
      <motion.div
        className="swipe-content"
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -96, right: 0 }}
        dragElastic={0.08}
        style={{ x }}
        onDragEnd={(_, info) => {
          const open = info.offset.x < -48 || info.velocity.x < -400;
          animate(x, open ? -96 : 0, reduce ? { duration: 0.2 } : { type: 'spring', stiffness: 500, damping: 40 });
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
