import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMotion } from '../lib/motion';

/** A small centred confirmation dialog (the iOS alert). */
export function Confirm({ open, title, message, action, destructive, onConfirm, onCancel }: {
  open: boolean;
  title: string;
  message: string;
  action: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { snappy, reduce } = useMotion();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div key="c" className="scrim" style={{ display: 'grid', placeItems: 'center', padding: 24, zIndex: 50 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}>
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="card stack gap-12"
            style={{ maxWidth: 340, width: '100%', padding: 22, borderRadius: 22 }}
            initial={reduce ? { opacity: 0 } : { scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={snappy}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-title" className="heading t-title3">{title}</h2>
            <p className="t-sub muted w6">{message}</p>
            <div className="row gap-8" style={{ marginTop: 6 }}>
              <button className="small-btn" style={{ background: 'var(--sand)', color: 'var(--ink)' }} onClick={onCancel} autoFocus>Cancel</button>
              <button className="small-btn" style={{ background: destructive ? 'var(--danger)' : 'var(--purple)' }} onClick={onConfirm}>{action}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
