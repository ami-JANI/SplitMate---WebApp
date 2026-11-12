import { BellOff, ChevronRight } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet } from '../components/Sheet';
import { Avatar, Empty, TwoToneTitle } from '../components/ui';
import { clearNotifications, markNotificationsRead } from '../data/actions';
import { useAppData } from '../data/appData';
import { useMe } from '../data/auth';
import { firstName } from '../lib/avatars';
import type { AppNotification } from '../lib/types';

function timeAgo(d: Date): string {
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Who added you to a hangout or as a friend, newest first. Opening it marks everything read. */
export function NotificationsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMe();
  const { notifications, hangouts } = useAppData();
  const navigate = useNavigate();

  // Mark as read a moment after opening, so the unread dots are seen first.
  useEffect(() => {
    if (!open) return;
    const unread = notifications.filter((n) => !n.read).map((n) => n.id);
    if (!unread.length) return;
    const t = setTimeout(() => void markNotificationsRead(me.id, unread), 1500);
    return () => clearTimeout(t);
  }, [open, notifications, me.id]);

  const go = (n: AppNotification) => {
    onClose();
    if (n.type === 'addedToHangout' && n.hangoutID && hangouts.some((h) => h.id === n.hangoutID)) navigate(`/hangout/${n.hangoutID}`);
    else navigate(`/member/${n.fromID}`);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Notifications"
      left={notifications.length > 0 ? <button className="text-btn" onClick={() => clearNotifications(me.id, notifications.map((n) => n.id))}>Clear all</button> : <span />}
      right={<button className="text-btn" onClick={onClose}>Done</button>}
    >
      <div className="stack gap-12" style={{ minHeight: '40dvh' }}>
        <TwoToneTitle light="What's" bold="new" size="var(--t-title3)" />
        {notifications.length === 0 ? (
          <Empty icon={<BellOff size={24} />}>Nothing yet. You'll see it here when someone adds you to a hangout or as a friend.</Empty>
        ) : (
          <div className="list">
            {notifications.map((n) => (
              <button key={n.id} className="list-row" onClick={() => go(n)} style={{ background: n.read ? undefined : 'color-mix(in srgb, var(--lavender) 45%, var(--paper))' }}>
                <Avatar avatar={n.fromAvatar} name={n.fromName} size={42} />
                <span className="grow">
                  <span className="t-sub" style={{ display: 'block' }}>
                    <span className="w8">{firstName(n.fromName)}</span>{' '}
                    {n.type === 'addedToHangout' ? (
                      <>added you to <span className="w8">{n.hangoutTitle || 'a hangout'}</span></>
                    ) : (
                      <>added you as a friend</>
                    )}
                  </span>
                  <span className="t-cap muted w7">{timeAgo(n.createdAt)}</span>
                </span>
                {!n.read && <span className="unread-dot" aria-label="New" />}
                <ChevronRight size={18} className="muted" />
              </button>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}
