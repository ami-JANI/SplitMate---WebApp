// Data stored in Cloud Firestore. Money is always whole paisa (1 taka = 100 paisa)
// so totals never drift. Timestamps arrive as Firestore Timestamps and are
// converted to JS Dates when read (see data/convert.ts).

export type HangoutKind = 'hangout' | 'tour';
export type HangoutStatus = 'active' | 'ended';
export type BillStatus = 'due' | 'inProgress' | 'delivered';

/** users/{uid}: the public profile. Email stays in Firebase Auth only. */
export interface AppUser {
  id: string;
  name: string;
  username: string;
  friendIDs: string[];
  showsExpenses: boolean;
  avatar?: string;
  createdAt: Date;
}

/** hangouts/{id} */
export interface Hangout {
  id: string;
  title: string;
  kind: HangoutKind;
  status: HangoutStatus;
  creatorID: string;
  memberIDs: string[];
  memberNames: Record<string, string>;
  memberAvatars: Record<string, string>;
  token: string;
  createdAt: Date;
  tokenExpiresAt: Date;
  /** Number of days for a tour, 1 for a hangout. */
  days: number;
  /** IANA zone of the creator. Every member computes day keys in this zone. */
  timeZone: string;
  settledDays: string[];
  totalSpentCents: number;
  endedAt?: Date;
  lastReminderAt?: Date;
}

/** hangouts/{id}/expenses/{id} */
export interface Expense {
  id: string;
  hangoutID: string;
  title: string;
  amountCents: number;
  paidByID: string;
  paidByName: string;
  splitAmongIDs: string[];
  dayKey: string;
  createdAt: Date;
}

/** hangouts/{id}/notices/{id} */
export interface HangoutNotice {
  id: string;
  message: string;
  forUserID?: string;
  createdAt: Date;
}

/** bills/{id} */
export interface Bill {
  id: string;
  hangoutID: string;
  hangoutTitle: string;
  hangoutMemberIDs: string[];
  fromID: string;
  fromName: string;
  fromAvatar?: string;
  toID: string;
  toName: string;
  toAvatar?: string;
  amountCents: number;
  dayKey?: string;
  status: BillStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** users/{uid}/notifications/{id}: someone added you to a hangout or as a friend. */
export interface AppNotification {
  id: string;
  type: 'addedToHangout' | 'friendAdded';
  fromID: string;
  fromName: string;
  fromAvatar?: string;
  hangoutID?: string;
  hangoutTitle?: string;
  read: boolean;
  createdAt: Date;
}

/** publicStats/{uid}: the shareable part of a user's spending summary. */
export interface PublicStats {
  visible: boolean;
  totalSpentCents: number;
  hangoutCount: number;
  busiestWeekday?: string;
  busiestMonth?: string;
  updatedAt?: Date;
}

export const isPaid = (status: BillStatus) => status === 'delivered';
export const billStatusTitle: Record<BillStatus, string> = {
  due: 'Due',
  inProgress: 'In progress',
  delivered: 'Delivered',
};

export const memberName = (h: Pick<Hangout, 'memberNames'>, uid: string) => h.memberNames[uid] ?? 'Someone';
export const memberAvatar = (h: Pick<Hangout, 'memberAvatars'>, uid: string) => h.memberAvatars?.[uid];
