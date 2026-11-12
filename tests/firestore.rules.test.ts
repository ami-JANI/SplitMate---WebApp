// Security-rule tests against the Firestore emulator. Run: npm run test:rules
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, increment, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;
const as = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;
const anon = () => env.unauthenticatedContext().firestore() as unknown as Firestore;

const inOneDay = () => Timestamp.fromMillis(Date.now() + 24 * 3600 * 1000);

function hangoutData(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Friday dinner',
    kind: 'hangout',
    status: 'active',
    creatorID: 'alice',
    memberIDs: ['alice', 'bob'],
    memberNames: { alice: 'Alice', bob: 'Bob' },
    memberAvatars: {},
    token: 'K7P2QX',
    createdAt: Timestamp.now(),
    tokenExpiresAt: inOneDay(),
    days: 1,
    timeZone: 'Asia/Dhaka',
    settledDays: [],
    totalSpentCents: 0,
    ...overrides,
  };
}

async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore() as unknown as Firestore, path), data);
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-splitmate',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(async () => env?.cleanup());
beforeEach(async () => env.clearFirestore());

describe('profiles', () => {
  it('signs up with a reserved username in one batch', async () => {
    const db = as('alice');
    const b = writeBatch(db);
    b.set(doc(db, 'users/alice'), { name: 'Alice', username: 'alice', friendIDs: [], showsExpenses: true, createdAt: serverTimestamp() });
    b.set(doc(db, 'usernames/alice'), { uid: 'alice' });
    await assertSucceeds(b.commit());
  });

  it('refuses a taken username and storing an email', async () => {
    await seed('usernames/alice', { uid: 'alice' });
    const db = as('mallory');
    const b = writeBatch(db);
    b.set(doc(db, 'users/mallory'), { name: 'M', username: 'alice', friendIDs: [], showsExpenses: true, createdAt: serverTimestamp() });
    b.set(doc(db, 'usernames/alice'), { uid: 'mallory' });
    await assertFails(b.commit());

    const c = writeBatch(db);
    c.set(doc(db, 'users/mallory'), { name: 'M', username: 'mallory', email: 'm@x.com', friendIDs: [], showsExpenses: true, createdAt: serverTimestamp() });
    c.set(doc(db, 'usernames/mallory'), { uid: 'mallory' });
    await assertFails(c.commit());
  });

  it('lets anyone check a username but only signed-in users read profiles', async () => {
    await seed('usernames/alice', { uid: 'alice' });
    await seed('users/alice', { name: 'Alice', username: 'alice', friendIDs: [], showsExpenses: true });
    await assertSucceeds(getDoc(doc(anon(), 'usernames/alice')));
    await assertFails(getDoc(doc(anon(), 'users/alice')));
    await assertSucceeds(getDoc(doc(as('bob'), 'users/alice')));
  });

  it('hides spending when it is private', async () => {
    await seed('publicStats/alice', { visible: false, totalSpentCents: 100, hangoutCount: 1 });
    await assertFails(getDoc(doc(as('bob'), 'publicStats/alice')));
    await assertSucceeds(getDoc(doc(as('alice'), 'publicStats/alice')));
  });
});

describe('username sign-in', () => {
  const key = 'a'.repeat(64);
  const withEmail = (uid: string, email: string) => env.authenticatedContext(uid, { email }).firestore() as unknown as Firestore;

  it('files only your own email, under a well-formed key', async () => {
    const db = withEmail('alice', 'alice@example.com');
    await assertSucceeds(setDoc(doc(db, `logins/${key}`), { uid: 'alice', email: 'alice@example.com' }));
    await assertFails(setDoc(doc(db, `logins/${'b'.repeat(64)}`), { uid: 'alice', email: 'someone@else.com' }));
    await assertFails(setDoc(doc(db, `logins/${'c'.repeat(64)}`), { uid: 'bob', email: 'alice@example.com' }));
    await assertFails(setDoc(doc(db, 'logins/alice'), { uid: 'alice', email: 'alice@example.com' }));
    // Nobody else can overwrite or remove it.
    await assertFails(setDoc(doc(withEmail('mallory', 'm@example.com'), `logins/${key}`), { uid: 'mallory', email: 'm@example.com' }));
    await assertFails(deleteDoc(doc(withEmail('mallory', 'm@example.com'), `logins/${key}`)));
  });

  it('can be fetched by exact key before sign-in, but never listed', async () => {
    await seed(`logins/${key}`, { uid: 'alice', email: 'alice@example.com' });
    await assertSucceeds(getDoc(doc(anon(), `logins/${key}`)));
    await assertFails(getDocs(collection(anon(), 'logins')));
    await assertFails(getDocs(collection(as('bob'), 'logins')));
  });
});

describe('notifications', () => {
  const note = (o: Record<string, unknown> = {}) => ({ type: 'addedToHangout', fromID: 'bob', fromName: 'Bob', hangoutID: 'h1', hangoutTitle: 'Friday dinner', read: false, createdAt: serverTimestamp(), ...o });

  it('tells someone they were added to a hangout, only together with the add', async () => {
    await seed('hangouts/h1', hangoutData());
    const db = as('bob');
    // Alone (nobody was added): refused.
    await assertFails(setDoc(doc(db, 'users/carol/notifications/n0'), note()));
    const b = writeBatch(db);
    b.update(doc(db, 'hangouts/h1'), { memberIDs: arrayUnion('carol'), 'memberNames.carol': 'Carol' });
    b.set(doc(db, 'users/carol/notifications/n1'), note());
    await assertSucceeds(b.commit());
    // Again, now that Carol is already a member: refused. And never in someone else's name.
    await assertFails(setDoc(doc(db, 'users/carol/notifications/n2'), note()));
    await assertFails(setDoc(doc(as('alice'), 'users/carol/notifications/n3'), note()));
  });

  it('tells someone they were added as a friend, once', async () => {
    await seed('users/bob', { name: 'Bob', username: 'bob', friendIDs: [], showsExpenses: true });
    const db = as('bob');
    const friend = note({ type: 'friendAdded', hangoutID: undefined, hangoutTitle: undefined });
    delete (friend as Record<string, unknown>).hangoutID;
    delete (friend as Record<string, unknown>).hangoutTitle;
    await assertFails(setDoc(doc(db, 'users/carol/notifications/f0'), friend));
    const b = writeBatch(db);
    b.update(doc(db, 'users/bob'), { friendIDs: arrayUnion('carol') });
    b.set(doc(db, 'users/carol/notifications/f1'), friend);
    await assertSucceeds(b.commit());
    await assertFails(setDoc(doc(db, 'users/carol/notifications/f2'), friend));
  });

  it('is private to its owner, who can mark it read or clear it', async () => {
    await seed('users/carol/notifications/n1', { ...note(), createdAt: Timestamp.now() });
    await assertFails(getDoc(doc(as('bob'), 'users/carol/notifications/n1')));
    await assertSucceeds(getDoc(doc(as('carol'), 'users/carol/notifications/n1')));
    await assertFails(updateDoc(doc(as('carol'), 'users/carol/notifications/n1'), { fromName: 'X' }));
    await assertSucceeds(updateDoc(doc(as('carol'), 'users/carol/notifications/n1'), { read: true }));
    await assertFails(deleteDoc(doc(as('bob'), 'users/carol/notifications/n1')));
    await assertSucceeds(deleteDoc(doc(as('carol'), 'users/carol/notifications/n1')));
  });

  it('notifies friends added while creating a hangout', async () => {
    const db = as('alice');
    const b = writeBatch(db);
    b.set(doc(db, 'hangouts/h9'), hangoutData({ token: 'ABCDEF' }));
    b.set(doc(db, 'hangoutTokens/ABCDEF'), { hangoutID: 'h9', creatorID: 'alice', expiresAt: inOneDay() });
    b.set(doc(db, 'users/bob/notifications/n1'), note({ fromID: 'alice', fromName: 'Alice', hangoutID: 'h9' }));
    await assertSucceeds(b.commit());
  });
});

describe('hangouts', () => {
  it('creates a hangout with its token in one write', async () => {
    const db = as('alice');
    const b = writeBatch(db);
    b.set(doc(db, 'hangouts/h1'), hangoutData({ memberIDs: ['alice'] }));
    b.set(doc(db, 'hangoutTokens/K7P2QX'), { hangoutID: 'h1', creatorID: 'alice', expiresAt: inOneDay() });
    await assertSucceeds(b.commit());
  });

  it('lets someone join with a valid token, but not after it expires', async () => {
    await seed('hangouts/h1', hangoutData());
    await assertSucceeds(updateDoc(doc(as('carol'), 'hangouts/h1'), { memberIDs: arrayUnion('carol'), 'memberNames.carol': 'Carol' }));
    await seed('hangouts/h2', hangoutData({ tokenExpiresAt: Timestamp.fromMillis(Date.now() - 1000) }));
    await assertFails(updateDoc(doc(as('carol'), 'hangouts/h2'), { memberIDs: arrayUnion('carol'), 'memberNames.carol': 'Carol' }));
  });

  it("stops a joiner adding others or renaming people", async () => {
    await seed('hangouts/h1', hangoutData());
    await assertFails(updateDoc(doc(as('carol'), 'hangouts/h1'), { memberIDs: arrayUnion('carol', 'dave'), 'memberNames.carol': 'Carol' }));
    await assertFails(updateDoc(doc(as('carol'), 'hangouts/h1'), { memberIDs: arrayUnion('carol'), 'memberNames.alice': 'X' }));
  });

  it('lets a member add people to an open hangout, and nothing else', async () => {
    await seed('hangouts/h1', hangoutData());
    await assertSucceeds(
      updateDoc(doc(as('bob'), 'hangouts/h1'), { memberIDs: arrayUnion('carol', 'dave'), 'memberNames.carol': 'Carol', 'memberNames.dave': 'Dave', 'memberAvatars.carol': 'nova' }),
    );
    // Not by outsiders, not while renaming an existing member, not by replacing the list, not without a name.
    await assertFails(updateDoc(doc(as('erin'), 'hangouts/h1'), { memberIDs: arrayUnion('frank'), 'memberNames.frank': 'Frank' }));
    await assertFails(updateDoc(doc(as('bob'), 'hangouts/h1'), { memberIDs: arrayUnion('erin'), 'memberNames.erin': 'Erin', 'memberNames.alice': 'X' }));
    await assertFails(updateDoc(doc(as('bob'), 'hangouts/h1'), { memberIDs: ['bob', 'erin'], 'memberNames.erin': 'Erin' }));
    await assertFails(updateDoc(doc(as('bob'), 'hangouts/h1'), { memberIDs: arrayUnion('erin') }));
    await assertFails(updateDoc(doc(as('bob'), 'hangouts/h1'), { memberIDs: arrayUnion('erin'), 'memberNames.erin': 'Erin', title: 'Hacked' }));
  });

  it('refuses adding people after the end', async () => {
    await seed('hangouts/h1', hangoutData({ status: 'ended' }));
    await assertFails(updateDoc(doc(as('bob'), 'hangouts/h1'), { memberIDs: arrayUnion('carol'), 'memberNames.carol': 'Carol' }));
  });

  it('only lets the creator end a hangout', async () => {
    await seed('hangouts/h1', hangoutData());
    await assertFails(updateDoc(doc(as('bob'), 'hangouts/h1'), { status: 'ended', endedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(as('alice'), 'hangouts/h1'), { status: 'ended', endedAt: serverTimestamp() }));
  });

  it('stops members changing the title, members or token', async () => {
    await seed('hangouts/h1', hangoutData());
    await assertFails(updateDoc(doc(as('bob'), 'hangouts/h1'), { title: 'Hacked' }));
    await assertFails(updateDoc(doc(as('bob'), 'hangouts/h1'), { memberIDs: ['bob'] }));
    await assertFails(updateDoc(doc(as('bob'), 'hangouts/h1'), { tokenExpiresAt: Timestamp.fromMillis(Date.now() + 1e12) }));
  });
});

describe('costs', () => {
  const expense = (o: Record<string, unknown> = {}) => ({
    hangoutID: 'h1',
    title: 'Dinner',
    amountCents: 60000,
    paidByID: 'alice',
    paidByName: 'Alice',
    splitAmongIDs: ['alice', 'bob'],
    dayKey: '2026-11-12',
    createdAt: serverTimestamp(),
    ...o,
  });

  async function add(uid: string, data: Record<string, unknown>, delta = data.amountCents as number) {
    const db = as(uid);
    const b = writeBatch(db);
    b.set(doc(db, 'hangouts/h1/expenses/e1'), data);
    b.update(doc(db, 'hangouts/h1'), { totalSpentCents: increment(delta) });
    return b.commit();
  }

  it('adds a cost and moves the total in step', async () => {
    await seed('hangouts/h1', hangoutData());
    await assertSucceeds(add('bob', expense()));
  });

  it('refuses non-members, outsiders in the split, wrong totals and settled days', async () => {
    await seed('hangouts/h1', hangoutData({ settledDays: ['2026-11-11'] }));
    await assertFails(add('carol', expense()));
    await assertFails(add('bob', expense({ splitAmongIDs: ['alice', 'carol'] })));
    await assertFails(add('bob', expense({ paidByID: 'carol' })));
    await assertFails(add('bob', expense(), 1));
    await assertFails(add('bob', expense({ dayKey: '2026-11-11' })));
    await assertFails(add('bob', expense({ amountCents: 0 })));
  });

  it('refuses costs after the end', async () => {
    await seed('hangouts/h1', hangoutData({ status: 'ended' }));
    await assertFails(add('bob', expense()));
  });
});

describe('bills', () => {
  const bill = (o: Record<string, unknown> = {}) => ({
    hangoutID: 'h1',
    hangoutTitle: 'Friday dinner',
    hangoutMemberIDs: ['alice', 'bob'],
    fromID: 'bob',
    fromName: 'Bob',
    toID: 'alice',
    toName: 'Alice',
    amountCents: 30000,
    status: 'due',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...o,
  });

  it('creates bills only while ending the hangout', async () => {
    await seed('hangouts/h1', hangoutData({ totalSpentCents: 60000 }));
    // Alone: refused.
    await assertFails(setDoc(doc(as('alice'), 'bills/b0'), bill()));
    // With the end, in one write: allowed.
    const db = as('alice');
    const b = writeBatch(db);
    b.set(doc(db, 'bills/b1'), bill());
    b.update(doc(db, 'hangouts/h1'), { status: 'ended', endedAt: serverTimestamp(), settledDays: arrayUnion('2026-11-12') });
    await assertSucceeds(b.commit());
  });

  it('settles tour days with many bills in one write', async () => {
    const members = ['a', 'b', 'c', 'd', 'e', 'f'];
    await seed('hangouts/t1', hangoutData({ kind: 'tour', days: 3, creatorID: 'a', memberIDs: members, memberNames: Object.fromEntries(members.map((m) => [m, m])) }));
    const db = as('c');
    const b = writeBatch(db);
    for (const day of ['2026-11-10', '2026-11-11']) {
      for (let i = 1; i < members.length; i++) {
        b.set(doc(db, `bills/${day}-${i}`), bill({ hangoutID: 't1', hangoutMemberIDs: members, fromID: members[i], toID: 'a', dayKey: day }));
      }
    }
    b.update(doc(db, 'hangouts/t1'), { settledDays: arrayUnion('2026-11-10', '2026-11-11') });
    await assertSucceeds(b.commit());
  });

  it('refuses a bill for a day that is already settled', async () => {
    await seed('hangouts/t1', hangoutData({ kind: 'tour', settledDays: ['2026-11-10'] }));
    const db = as('alice');
    const b = writeBatch(db);
    b.set(doc(db, 'bills/x'), bill({ hangoutID: 't1', dayKey: '2026-11-10' }));
    b.update(doc(db, 'hangouts/t1'), { settledDays: arrayUnion('2026-11-11') });
    await assertFails(b.commit());
  });

  it('moves stages: payer marks paid, receiver confirms, nobody else', async () => {
    await seed('bills/b1', { ...bill(), createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    await assertFails(updateDoc(doc(as('alice'), 'bills/b1'), { status: 'inProgress', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as('carol'), 'bills/b1'), { status: 'delivered', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as('bob'), 'bills/b1'), { amountCents: 1, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(as('bob'), 'bills/b1'), { status: 'inProgress', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as('bob'), 'bills/b1'), { status: 'delivered', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(as('alice'), 'bills/b1'), { status: 'delivered', updatedAt: serverTimestamp() }));
  });
});

describe('reminders', () => {
  it('posts a round only after the end', async () => {
    await seed('hangouts/h1', hangoutData());
    await assertFails(updateDoc(doc(as('bob'), 'hangouts/h1'), { lastReminderAt: serverTimestamp() }));
    await seed('hangouts/h2', hangoutData({ status: 'ended', endedAt: Timestamp.now() }));
    const db = as('bob');
    const b = writeBatch(db);
    b.set(doc(db, 'hangouts/h2/notices/n1'), { message: 'Reminder: Bob still owes Alice ৳300 (due).', forUserID: 'bob', createdAt: serverTimestamp() });
    b.update(doc(db, 'hangouts/h2'), { lastReminderAt: serverTimestamp() });
    await assertSucceeds(b.commit());
  });
});
