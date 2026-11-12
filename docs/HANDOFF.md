# SplitMate: handoff for a cross-platform web build

**Goal:** rebuild SplitMate as a web app that works on Android and iOS phones (and desktop browsers), matching the existing iOS app's features, look and feel.

**Source of truth:** the SwiftUI iOS app on `main` of `ami-JANI/SplitMate---A-SwiftUI-based-group-expense-tracker`, snapshot taken 12 Nov 2026 (commit `877170c`). A copy of that source is in `ios-source/` for reference. Where this document and the Swift code disagree, the Swift code shows what the app actually does today; this document says what the web build should do.

Read this file top to bottom once, then use the section numbers as a reference while building.

---

## Contents

1. [What SplitMate is](#1-what-splitmate-is)
2. [Recommended stack](#2-recommended-stack)
3. [Screens and features](#3-screens-and-features)
4. [Business rules](#4-business-rules)
5. [Data model](#5-data-model)
6. [How settling works (the algorithm)](#6-how-settling-works)
7. [Stats for the side menu and profiles](#7-stats)
8. [Security rules](#8-security-rules)
9. [Design system](#9-design-system)
10. [Motion and animation](#10-motion-and-animation)
11. [Known limits and what a web build should improve](#11-known-limits-and-improvements)
12. [Suggested build order and acceptance checklist](#12-build-order-and-acceptance-checklist)
13. [What's in this package](#13-whats-in-this-package)

---

## 1. What SplitMate is

An app for splitting the cost of hangouts with friends.

1. Someone **creates a hangout** (one day) or a **tour** (2 to 30 days) and shares its 6-character **join token**.
2. Friends **join with the token**.
3. While it runs, anyone adds **costs**: what, how much, who paid, and who shares it (everyone, or only some members).
4. A **live split** shows each person's balance and the payments that would settle it, with the viewer's own payments first.
5. When the creator **ends** the hangout (or, for a tour, when **each day ends**), the app turns the balances into the **fewest possible payments**, called **bills**.
6. Each bill moves **Due → In progress → Delivered**: the payer says "I've paid it", the receiver confirms.
7. Anyone who still owes gets a **reminder inside the hangout every 2 hours** until they pay.

Currency is Bangladeshi taka (**৳**). Tagline: *"Hang out. Split fair. Settle up."*

---

## 2. Recommended stack

The stack is open; this is a recommendation, with reasons.

| Layer | Recommendation | Why |
|-------|----------------|-----|
| App type | **Installable PWA** (Progressive Web App), mobile-first | One codebase for Android, iOS and desktop. Installs to the home screen, runs full screen, works offline for reading. |
| UI | **React + TypeScript + Vite** | Large ecosystem, easy hiring/help, fast dev server. |
| Styling | CSS variables for the tokens in §9 (plain CSS modules or Tailwind configured with these tokens) | Keeps colours/radii in one place, like `Theme.swift`. |
| Animation | **Motion** (formerly Framer Motion) | Spring physics that map directly to the SwiftUI springs in §10, plus `useReducedMotion`. |
| Routing | React Router (or TanStack Router) | Maps to the iOS `Route` enum: home, hangout/:id, profile, member/:id, friends. |
| Backend | **Firebase**: Authentication (email/password) + Cloud Firestore | Same data model and security rules as the iOS app, so both apps could even share one database. |
| Server jobs | **Cloud Functions for Firebase** (scheduled + triggers) | Fixes the biggest limit of the iOS app: day-end settling and reminders currently only happen when someone has the app open (§11). |
| Push | **Firebase Cloud Messaging (web push)** | Real reminder notifications. Works on Android Chrome; on iOS (16.4+) only once the PWA is added to the home screen. |
| PWA tooling | `vite-plugin-pwa` (Workbox) | Manifest, service worker, offline caching. |
| Optional later | **Capacitor** to wrap the same web app for the App Store / Play Store | Only if store presence or more reliable iOS push is needed. |

Alternatives that also work: Next.js (if you want server rendering, not needed here), SvelteKit, or Flutter Web (heavier, less "web"). Supabase could replace Firebase, but then the rules in §8 must be rewritten as Postgres row-level security.

**Firestore web SDK notes:** use the modular v10+ SDK (`firebase/app`, `firebase/auth`, `firebase/firestore`). The iOS managers map 1:1 to React hooks/stores: `AuthViewModel` → `useAuth`, `HangoutListManager` → `useHangouts`, `HangoutManager` → `useHangout(id)`, `BillManager` → `useBills`, `FriendsManager` → `useFriends`, `StatsManager` → `useStats`, `MemberProfileManager` → `useMemberProfile(id)`. Each uses `onSnapshot` where the iOS one uses `addSnapshotListener`.

---

## 3. Screens and features

Mockups are in `mockups/`. They were drawn before the avatars and final fonts were added, so use `mockups/15-avatars.png` and `mockups/16-new-fonts.png` (and `avatars/`) for those details. Everything else in the mockups matches the app. `mockups/all-screens.png` shows all screens side by side.

Navigation: one stack. Home is the root; the side menu slides over it. Pushed screens: **Hangout**, **My profile**, **Member profile**, **Find friends**. Sheets (bottom sheets on web): **Create hangout**, **Join with token**, **Add a cost**, **Choose avatar**.

### 3.1 Sign in (`mockups/01-sign-in.png`)
- Purple hero card (radius 28, height ~200): yellow "people" icon, two-tone title **SPLIT MATE** (light "Split", bold "Mate"), tagline "Hang out. Split fair. Settle up."
- Title "WELCOME **BACK**".
- Pill text fields: Email (envelope icon), Password (lock icon, secure).
- Error banner (pink/red tint) when something fails.
- Purple pill button "Sign in" with a spinner while working.
- Link: "New here? **Create an account**" → Sign up.

### 3.2 Sign up (`mockups/02-sign-up.png`)
- Title "JOIN THE **CREW**"; helper "Friends find you by your username, so pick one you like."
- **Avatar picker** (8 avatars, §3.13), fields: Full name, Username (@), Email, Password ("Password (6+ characters)").
- Button "Create account"; link "Already have an account? **Sign in**".
- Validation (show the first problem only, in this order):
  - Name required → "Name is missing"
  - Username required, 3-20 characters, only letters, numbers, dots and underscores; stored **lowercase** → "Username is missing" / "Username must be 3-20 characters" / "Use only letters, numbers, dots and underscores"
  - Email required and contains "@" → "Email is missing" / "That email doesn't look right"
  - Password required, at least 6 characters → "Password is missing" / "Password needs at least 6 characters"
  - Username taken → "@name is already taken"
- Sign-up flow: check `usernames/{handle}` doesn't exist → create Auth user → batch-write `users/{uid}` and `usernames/{handle}`.

### 3.3 Home (`mockups/03-home.png`, `04-home-past-hangouts.png`)
Top to bottom:
1. **Top bar:** round menu button (48px, sand background) → opens side menu; "Hello, **FirstName**"; own avatar (48px) → My profile.
2. **Greeting:** "Split it **fair.**" (light + bold heading, 38px).
3. **Create a Hangout card:** big purple card (height 260, radius 28, purple shadow), two-tone "CREATE A **HANGOUT**" in white, round white arrow button (56px), text "Dinner, movie, a day out? Start one, share the token, and add costs as you go.", three glass tags: "1-day token", "Fair split", "Tours". Two soft decorative circles (white 8% and yellow 25%). Whole card is tappable → Create hangout sheet.
4. **Join card:** yellow card, "GOT A **TOKEN?**", "Join a friend's hangout or tour", white round "+" button → Join sheet.
5. **Owe banner** (only if non-zero): two halves "YOU OWE" (yellow amount) and "OWED TO YOU" (sage amount), from unpaid bills.
6. **"HAPPENING NOW"**: active hangouts/tours as rows: kind icon tile (purple for hangout, sage for tour), title, "Hangout · 4 people", total in the number font, "LIVE" label.
7. **"PAST HANGOUTS"**: ended hangouts as big cards: title (uppercase heading), date + people count, "TOTAL" amount (purple), each bill as "You → Bashir ৳450 [chip]", a progress bar (sage) and "1 of 3 bills paid". If no bills: "Everyone paid their own share. Nothing to settle." Empty state: sparkles icon + "Ended hangouts and their bills show up here."

Lists are sorted newest first (by `createdAt`).

### 3.4 Side menu (`mockups/05-side-menu.png`)
Slides in from the left, 320px wide, over a 30% black scrim; home scales down slightly behind it. Close with the ✕ button, tapping the scrim, or **swiping left** (follows the finger; closes past 80px).
- Header: avatar (58px), name, @username, ✕.
- Buttons: "My profile", "Find friends".
- "MY **NUMBERS**" tiles (see §7 for maths):
  - **I owe**: list of people with amounts (light yellow tile). Empty: "You don't owe anyone".
  - **Owes me**: list (lavender tile). Empty: "Nobody owes you".
  - 2×2 grid: **Total spend** (purple, "your share, all hangouts"), **Per hangout** (sage, "average over N"), **Top day** (yellow, "you spend most on"), **Top month** (deep purple, "your biggest month").
  - **Most transactions with** (ink tile): name and "N bills together".
  - **Spend per hangout**: list of hangout titles with your share.
- "Sign out" (destructive).
- When the menu opens, it loads all expenses of all your hangouts once, computes the summary, and writes the shareable part to `publicStats/{uid}` (§5).

### 3.5 Create hangout sheet (`mockups/10-create-hangout.png`)
- Name field (placeholder "e.g. Friday dinner"). Error "Give it a name" if empty.
- Type: segmented **Hangout | Tour**. When Tour: stepper "Lasts N days" (2 to 30, default 3), animated in.
- Footer text: Hangout → "A hangout's join token works for 1 day. Need longer? Make it a tour." Tour → "A tour settles each day's costs at the end of that day. Its token works until the last day."
- "Add friends now (optional)": friend rows with toggles; toggled friends become members immediately.
- Title "New hangout" / "New tour"; Cancel / Create.

### 3.6 Join with token sheet (`mockups/11-join-token.png`)
- Title "ENTER THE **TOKEN**"; helper "Ask whoever started the hangout for its token. Hangout tokens last one day; tour tokens last until the tour's final day."
- Big monospace token field (uppercase, 6 characters).
- Errors: "A token has 6 characters", "No hangout uses that token", "This token has expired. Hangout tokens last one day; start a tour for longer trips.", "You're already in this hangout", "Couldn't join. The hangout may have ended."

### 3.7 Hangout screen (`06-hangout-live.png`, `06-live-split-mine-first.png`, `07-hangout-bills.png`, `08-tour.png`)
Title bar shows the hangout title; "+" button (only while active) opens Add a cost.
1. **Header card** (purple): kind chip (yellow, "HANGOUT"/"TOUR"), "LIVE" or "ENDED", title (uppercase, 34px heading), "TOTAL SPENT" in the number font (counts up when it changes), and the **token box** (white, monospace token + "valid until 13 Nov, 8:15 PM") while the token is valid; "Token expired" when it isn't and the hangout is still active.
2. **Member strip**: horizontally scrolling avatars (54px) with names; the creator has a small crown badge; "You" for yourself. Tap → member profile (or My profile for yourself).
3. **Error banner** if any.
4. **Reminders** (lavender card, "REMINDERS" with bell icon): latest 5 notices with time; notices about the viewer are **bold**.
5. **Live split card** (light yellow), shown while active and there are costs (title "LIVE **SPLIT**", or "TODAY'S **SPLIT**" for tours):
   - **Your own transfers first:** "YOU OWE" group (deep purple amounts), then "OWES YOU" group (sage). If neither: "You're even. Nothing to pay or collect."
   - Then "BETWEEN THE OTHERS".
   - Caption: "Becomes bills when the hangout is ended." / tours: "Becomes bills at the end of the day."
   - "BALANCES": every member, **you at the top**, "gets ৳150" (sage) / "owes ৳250" (deep purple) / "even" (muted).
   - Only counts costs on days not yet settled.
6. **"THE BILLS"** (once bills exist): one bill card each (§3.9).
7. **"ALL COSTS"**: cost rows, newest first. For tours, grouped by day with a day header "THU, 12 NOV" and a label: "Today" (clock, purple), "Closing" (past day not yet settled), or "Settled" (check, sage). Swipe a cost to **delete** (only while the hangout is active and its day isn't settled). Empty: "No costs yet. Tap + to add the first one." / ended: "No costs were added."
8. **End button** (creator only, while active): dark pill "End the hangout" / "End the tour" with a chequered flag. Confirmation: title "End {title}?", message "No one can add costs after this. Anyone who still owes gets a reminder here every 2 hours until they pay.", action "End and create bills".

Cost row: payer avatar, title, "You paid · split 4 ways", amount, and "your share ৳450" (purple) when the viewer is in the split.

### 3.8 Add a cost sheet (`09-add-cost.png`, `09-add-cost-split-choice.png`)
- "What was it?": title (placeholder "e.g. Dinner at Jhau Bon") and amount field "Amount (৳)" (commas allowed).
- "Who paid?": picker of members, default **You**.
- "Split equally between": a radio row **"All N members"** (on by default). While All is on, the member rows below are faded (35% opacity) and disabled. Turning All off lets you pick only the members who shared it (e.g. the three who took the taxi). Default picked set when All is turned off: just you.
- Footer: "৳450 each for 4 people" / "Split between N people" / "Pick at least one person".
- Validation: "Title is missing", "Amount is missing", "Amount must be greater than zero", "Pick at least one person to split with", "This hangout has ended", "Today's bills are already settled".
- Save writes the expense **and** increments `hangout.totalSpent` in one batch. `splitAmongIDs` is always stored as an explicit list in member order (with All, that's every current member), so people who join later don't share earlier costs.

### 3.9 Bills (inside a hangout, past-hangout cards, member profile)
Bill card: payer avatar → receiver avatar, "You → Bashir" (uses "You"/"you" for the viewer), tour day label if any, amount (number font), status chip, a **3-step stage tracker** (dots + lines: Due, In progress, Delivered; filled purple up to the current stage; current dot slightly larger), and the action for whoever acts next:

| Status | Viewer is payer | Viewer is receiver | Others |
|--------|-----------------|--------------------|--------|
| Due | Purple button "I've paid it" → In progress | Sage button "Confirm received" → Delivered | nothing |
| In progress | "Waiting for {name} to confirm" | "Confirm received" → Delivered | nothing |
| Delivered | nothing | nothing | nothing |

The receiver may confirm straight from Due. A bill the viewer still has to pay gets a light yellow background. Status chips: Due = yellow with clock icon (ink text), In progress = purple with ⇄ icon, Delivered = sage with check-seal icon (white text). A light haptic (`navigator.vibrate` on Android; none on iOS web) plays when a bill moves stage.

### 3.10 My profile (`mockups/12-my-profile.png`)
- Lavender header: avatar (96px) with a small purple paintbrush badge → Choose avatar sheet; "Tap to change avatar"; name (uppercase heading) with a pencil button → "Change your name" dialog; @username (purple); email.
- **Privacy card:** toggle "Show my spending to others" (eye / eye-slash icon). On: "Hangout members can see your total spend, busiest day and month on your profile." Off: "Your spending is hidden. Others only see your name and username." Toggling writes `users.showsExpenses` and `publicStats.visible` in one batch.
- Two tiles: "I owe" (yellow) and "Owed to me" (sage) from unpaid bills.
- "MY **FRIENDS**" with a "Find" link; friend rows → member profile. Empty: "Search by username to add friends."
- "Sign out".
- Changing the avatar also updates `memberAvatars.{uid}` in every hangout you're in.

### 3.11 Member profile (`mockups/13-member-profile.png`)
- Purple header: avatar (92px), name (white), @username (yellow), button "Add friend" / "✓ Friends" (tap again to remove).
- "THEIR **SPENDING**" tiles if they allow it: Total spend ("over N hangouts") and Top day ("busiest month: October"). If hidden: eye-slash + "{name} keeps their spending private." If allowed but nothing published yet: "{name} hasn't shared any spending yet."
- "BETWEEN **US**": bills between you and them, with the same actions as §3.9 (no tracker).

### 3.12 Find friends (`mockups/14-find-friends.png`)
- Search field "Search by username"; prefix search on lowercase username (strip a leading "@"), max 20 results, excludes yourself. "No one found with @query".
- "FIND **PEOPLE**" results: tap a row → member profile; add button (person+) or ✓ if already a friend. "MY **FRIENDS**" list below; swipe a friend left to remove (on the web, also offer a visible remove action in the row or member profile).
- Friendship is **one-way** (adds to your `friendIDs` only).

### 3.13 Avatars (`mockups/15-avatars.png`, `avatars/`)
Eight flat cartoon faces, drawn from simple shapes on a 100×100 canvas, clipped to a circle with a 2px white ring. Ready-made SVGs are in `avatars/` (generated from `FaceAvatarView.swift`; open `avatars/index.html` to preview). Only the **id** is stored.

| id | Name | Background | Skin | Hair | Shirt | Hair style | Accessory |
|----|------|------------|------|------|-------|-----------|-----------|
| `nova` | Nova | purple | light | dark brown | yellow | long | earrings |
| `rio` | Rio | yellow | brown | black | deep purple | curly | headphones |
| `sky` | Sky | lavender | fair | blue | ink | bob | glasses |
| `zara` | Zara | sage | tan | teal | teal | headscarf | none |
| `kai` | Kai | orange `#FA944C` | light | dark brown | sage | quiff | beanie |
| `mimi` | Mimi | pink `#F58FAD` | deep | black | paper | buns | earrings |
| `leo` | Leo | sea `#5CB2C7` | fair | ginger | yellow | side-swept | glasses |
| `ash` | Ash | deep purple | tan | blonde | pink `#F58FAD` | ponytail | cap |

No avatar picked → a circle with up to two initials (heading font, 38% of size, white) on a colour chosen from [purple, yellow, sage, deepPurple] by `(sum of the name's unicode code points) % 4`, so the same name always gets the same colour.

Choose avatar sheet: two-tone title "PICK YOUR **LOOK**", 4-column grid, the selected one gets a 3px purple ring and scales to 1.08 (snappy spring), button "Use this avatar". The same picker sits on the sign-up screen. Copy: "Your avatar shows next to your name in hangouts, bills and friend lists."

---

## 4. Business rules

### 4.1 Hangout vs tour
| | Hangout | Tour |
|---|---|---|
| Length | One day | 2 to 30 days (chosen at creation) |
| Token valid until | creation time + **24 hours** | **midnight at the end of the last day** (start of creation day + N days) |
| Settled | All at once when the creator taps End | **Each day at the end of that day**, and any remaining days when the creator taps End |
| Bills carry | no day | `dayKey` of the day they settle |

### 4.2 Tokens
- 6 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no 0/O/1/I so a token read aloud can't be mistyped). Input is uppercased and trimmed.
- `hangoutTokens/{TOKEN}` maps to `{ hangoutID, creatorID, expiresAt }`. Created in the same batch as the hangout.
- Collision: the iOS app doesn't check; because token docs can't be updated, a collision makes the create fail. **Web build:** check/retry on collision (or create the token in a transaction).
- A token works only while the hangout is active and before `tokenExpiresAt`. Joining adds the user to `memberIDs`, `memberNames.{uid}` and `memberAvatars.{uid}`.

### 4.3 Days
- A day is a `dayKey` string `yyyy-MM-dd` in the **device's local time zone**. Strings sort correctly, so "is this day over?" is `dayKey < todayKey`.
- Each expense is stamped with today's dayKey when added.
- A tour day is "finished" when `dayKey < today` and it isn't in `hangout.settledDays`. Finished days are settled automatically (§4.4).
- **Web build:** store an explicit `timeZone` on the hangout (the creator's IANA zone) and compute day keys in that zone, so members in different zones agree.

### 4.4 Settling into bills
Run in a **Firestore transaction** so two devices can never create the same bills twice:
1. Read the hangout fresh; stop if it's not `active`.
2. `openDays` = requested days minus `settledDays` (another member may have just settled some).
3. Tour: one settlement per open day (only that day's expenses). Hangout: one settlement over all open expenses.
4. For each settlement, compute transfers (§6) using the hangout's **current** `memberIDs`, and write one `bills` doc per transfer with status `due`, names and avatars copied from the hangout.
5. Update the hangout: `settledDays` ∪= openDays; and when ending: `status = ended`, `endedAt = now`.

Who triggers it in the iOS app: **End** (creator only) settles every day that has expenses and ends the hangout. For tours, any member's open hangout screen calls "settle finished tour days" on open, whenever the expense count changes, and every 60 seconds.

Once a day is settled, its costs can't be added to or deleted. After the hangout ends, nothing can be added or deleted.

### 4.5 Reminders
- After a hangout ends, while any of its bills are unpaid (not Delivered), a reminder round is due every **2 hours** since `lastReminderAt` (or `endedAt` for the first one).
- A round writes one notice per unpaid bill: *"Reminder: {from} still owes {to} ৳{amount} ({status lowercase})."* with `forUserID = fromID`, and sets `lastReminderAt = now`, inside a transaction that re-checks the 2-hour gap, so only one device sends each round.
- Triggered in the iOS app by home (for all past hangouts) on appear and every 60 s, and by the hangout screen. Reminders are in-app notices only, not push notifications.

### 4.6 Bills
- Status only moves forward: `due → inProgress` (payer only), `due|inProgress → delivered` (receiver only). Only `status` and `updatedAt` may change.
- "Open"/"unpaid" means not Delivered (Due and In progress both count as still owed in totals).

### 4.7 Money
- Store amounts as numbers in taka (the iOS app uses Double). All settlement maths is done in **whole paisa** (`round(amount × 100)`), so shares always add up exactly.
- Display: `৳` + number with thousands separators, 0 to 2 decimals (`৳1,800`, `৳33.34`). Use `Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })`.
- **Web build:** consider storing integer paisa (`amountCents`) to avoid float drift in `totalSpent`.

---

## 5. Data model

Cloud Firestore. All timestamps are Firestore `Timestamp`. `id` is the document id.

### `users/{uid}`
| Field | Type | Notes |
|-------|------|-------|
| name | string | trimmed |
| username | string | lowercase, unique, 3-20 chars `[a-z0-9_.]` |
| email | string | |
| friendIDs | string[] | one-way friend list |
| showsExpenses | bool | default true |
| createdAt | timestamp | |
| avatar | string? | avatar id (§3.13) or missing |

### `usernames/{username}`
`{ uid }`. Reserves a username. Readable without sign-in so availability can be checked.

### `publicStats/{uid}`
`{ visible: bool, totalSpent: number, hangoutCount: int, busiestWeekday?: string, busiestMonth?: string, updatedAt }`. Readable by others only when `visible`.

### `hangouts/{id}`
| Field | Type | Notes |
|-------|------|-------|
| title | string | |
| kind | `"hangout"` \| `"tour"` | |
| status | `"active"` \| `"ended"` | |
| creatorID | string | only they can End |
| memberIDs | string[] | creator first is not guaranteed |
| memberNames | map uid → name | denormalised so cards need no extra reads |
| memberAvatars | map uid → avatar id | optional |
| token | string | |
| createdAt | timestamp | |
| tokenExpiresAt | timestamp | §4.1 |
| settledDays | string[] | dayKeys already turned into bills |
| totalSpent | number | incremented/decremented with each cost |
| endedAt | timestamp? | |
| lastReminderAt | timestamp? | |

### `hangouts/{id}/expenses/{id}`
`{ hangoutID, title, amount, paidByID, paidByName, splitAmongIDs: string[], dayKey, createdAt }`. Never updated; delete only (see rules).

### `hangouts/{id}/notices/{id}`
`{ message, forUserID?, createdAt }`. Shown newest first, latest 20 loaded, 5 displayed.

### `hangoutTokens/{TOKEN}`
`{ hangoutID, creatorID, expiresAt }`.

### `bills/{id}` (top level, so one query shows every bill across hangouts)
`{ hangoutID, hangoutTitle, hangoutMemberIDs: string[], fromID, fromName, toID, toName, fromAvatar?, toAvatar?, amount, dayKey?, status: "due"|"inProgress"|"delivered", createdAt, updatedAt }`.

### Queries used
- My hangouts: `hangouts where memberIDs array-contains uid` (sorted client-side by createdAt desc, so no composite index).
- My bills: `bills where hangoutMemberIDs array-contains uid` (sorted client-side).
- Hangout costs: subcollection ordered by `createdAt desc`.
- Friend search: `users where username >= q and username < q + '' limit 20`.
- Friends: `users where documentId in friendIDs` (max 30 per query; batch if more).

---

## 6. How settling works

SplitMate doesn't make everyone pay everyone. It finds each person's **net balance** (what they paid minus their fair share), then matches people who owe with people who are owed. A group of *n* people never needs more than *n − 1* payments.

**Step 1: balances (in paisa).** For each expense: the payer gets `+amount`. The people in `splitAmongIDs` are **sorted by id**, and the amount is split equally; the leftover paisa (`amount % count`) go one each to the first people in that sorted order. This keeps results identical on every device.

**Step 2: transfers.**
1. *Exact matches first:* any debtor who owes exactly what some creditor is owed pays them in one go (ties → creditor with the smallest id).
2. *Then greedy:* sort creditors and debtors biggest first (ties → smaller id first); the biggest debtor pays the biggest creditor `min(owed, owing)`; remove anyone who reaches zero; repeat.

**Worked example.** A, B, C and D go out. A pays ৳600, B pays ৳1,000, C pays ৳200, D pays nothing (total ৳1,800, ৳450 each).

| | Paid | Fair share | Balance |
|---|---:|---:|---:|
| A | 600 | 450 | +150 |
| B | 1,000 | 450 | +550 |
| C | 200 | 450 | −250 |
| D | 0 | 450 | −450 |

Exact-match pass: none (450, 250 vs 550, 150). Greedy: D (450) → B (550) **৳450**; B now 100. C (250) → A (150) **৳150**; C now 100 → B (100) **৳100**.

Result: **D → B ৳450, C → A ৳150, C → B ৳100.** Three payments.

A TypeScript port with tests (including this example, a partial split and leftover paisa) is in `reference/settlement.ts` and `reference/settlement.test.ts`. Run: `node --experimental-strip-types reference/settlement.test.ts` (Node 22+). The Swift original is `ios-source/SplitMate/Models/SettlementCalculator.swift`.

Note: the per-person "your share" shown on a cost row uses plain division (`amount / count`) for display; only settlement uses paisa.

---

## 7. Stats

Computed client-side for the signed-in user from all their hangouts, all expenses in those hangouts, and all their bills (`StatsCalculator` in `ios-source/SplitMate/Models/SpendingSummary.swift`).

- **"Spend" means the user's own share** of each cost (`share(of: uid)`), not what they paid for others.
- **I owe / Owes me:** unpaid bills grouped by the other person, summed, biggest first.
- **Total spend:** sum of the user's shares.
- **Per hangout:** user's share per hangout (list, biggest first); **average** = total / number of hangouts where the user had a share.
- **Top day:** weekday name with the highest share total (day from `dayKey`).
- **Top month:** month name with the highest share total.
- **Most transactions with:** the person who appears with the user on the most bills (paid or not); shows the count.
- After computing, write `publicStats/{uid}` = `{ visible: showsExpenses, totalSpent, hangoutCount, busiestWeekday, busiestMonth }`. Member profiles read this.

**Web build:** move this into a Cloud Function (on expense/bill writes) so `publicStats` is always fresh, not only after the owner opens the menu.

---

## 8. Security rules

The deployed rules are in `firebase/firestore.rules` (identical to the iOS repo). Summary:

- `users`: any signed-in user can read (needed for username search); only the owner can create/update; no deletes.
- `usernames`: anyone can `get`; signed-in users create their own (uid must match); no update/delete.
- `publicStats`: owner reads/writes; others read only if `visible == true`.
- `hangoutTokens`: signed-in `get`; creator creates; immutable.
- `hangouts`: members read/update; anyone signed in creates if they're the creator and a member. A non-member may update only to **add themselves** (only `memberIDs`, `memberNames`, `memberAvatars` change; exactly one id added; hangout active; before `tokenExpiresAt`).
- `expenses`: members read; create only while active, day not settled, amount > 0; delete only while active and day not settled; never update.
- `notices`: members read/create; immutable.
- `bills`: hangout members read; create only with status `due`; update only `status`/`updatedAt`, payer `due→inProgress`, receiver `due|inProgress→delivered`; no deletes.

**Gaps worth fixing in the web build:**
- `users` docs (including **email**) are readable by every signed-in user. Split public profile fields (name, username, avatar) from private ones (email), or move search to a function.
- Any member can update any hangout field (e.g. `status`). Restrict `status`/`endedAt`/`settledDays` changes to the settling path, or do settling in a Cloud Function with the Admin SDK and lock those fields for clients.
- Bills can be created by any hangout member with arbitrary amounts. If settling moves to a Cloud Function, set `bills` create to `false` for clients.
- Expense creates don't check that `paidByID`/`splitAmongIDs` are members.

---

## 9. Design system

Warm cream background, purple + yellow accents, big rounded cards, two-tone uppercase headings (light word + bold word, e.g. "PAST **HANGOUTS**"). Inspiration images that set the direction are in `design-inspiration/` (third-party, for mood only; do not ship them).

### 9.1 Colours
| Token | Hex | Use |
|-------|-----|-----|
| `cream` | `#F7F2E6` | app background |
| `sand` | `#E8E0CC` | round icon buttons, empty tracker parts |
| `paper` | `#FFFCF5` | cards, rows, fields |
| `purple` | `#946BCC` | primary: hero cards, buttons, links, In progress chip |
| `deepPurple` | `#66459E` | "you owe" amounts, Top month tile |
| `lavender` | `#DBCCF2` | profile header, reminders, "Owes me" tile |
| `yellow` | `#FFC233` | Join card, Due chip, kind chip, "you owe" banner |
| `lightYellow` | `#FFE08C` | live split card (at 60%), unpaid-by-me bill (at 50%), "I owe" tile |
| `sage` | `#73876B` | positive money, Delivered chip, tours, confirm button |
| `ink` | `#2B2633` | main text, End button, dark tile |
| `mutedInk` | `#736B7A` | secondary text |
| white | `#FFFFFF` | text on purple, token box, round arrow buttons |

Avatar-only colours: orange `#FA944C`, pink `#F58FAD`, sea `#5CB2C7`; skin fair `#FFDBBD`, light `#F5C7A1`, tan `#DEA878`, brown `#A16B47`, deep `#6B452E`; hair black `#211C24`, dark brown `#4F3324`, ginger `#D96B29`, blonde `#F5CC61`, blue `#4CA8E6`, teal `#299994`.

The iOS app is light-only. A dark theme is optional; if added, keep purple/yellow and swap cream/paper/ink.

### 9.2 Radii and spacing
- Big cards: **28px** radius. Small cards, rows, banners: **18px**. Buttons inside bills: 12px. Menu buttons, token box: 14px. Icon tiles: 16px. Chips, pills, toggles: fully round.
- Screen padding 20px (sign-in 24px). Vertical gap between home sections 20px. Card padding 16-24px.
- Create card height 260px; hero shadow `0 10px 32px rgba(148,107,204,0.3)`.

### 9.3 Fonts (all SIL Open Font License 1.1, files + licences in `fonts/`)
| Role | Font | Weights | Where |
|------|------|---------|-------|
| Headings (bold half) | **Fredoka** | Bold 700 | two-tone titles, hangout titles, names |
| Headings (light half) | **Fredoka** | Light 300 (SemiBold 600 also bundled) | first word of two-tone titles, "Split it" |
| Body | **Nunito** | Regular 400, SemiBold 600, Bold 700, ExtraBold 800 | all text, buttons, labels |
| Money / big numbers | **Lilita One** | Regular | totals, bill amounts, stat values |
| Tokens | **Space Mono** | Bold 700 | join tokens |

All four are on Google Fonts, so on the web you can load them from there or self-host the TTFs here (convert to WOFF2). Body sizes follow iOS text styles: largeTitle 34, title 28, title2 22, title3 20, headline/body 17 (headline is bold), callout 16, subheadline 15, footnote 13, caption 12, caption2 11. Use `rem` so text scales with the user's browser setting (the iOS app follows Dynamic Type).

Common heading sizes: greeting 38, Create card 34, hangout title 34, sign-in hero 44, section titles 22-24, profile name 30. Two-tone titles are **uppercased**.

### 9.4 Icons
The iOS app uses SF Symbols, which can't ship on the web. Use an open icon set with close equivalents (Lucide or Phosphor work well): menu, arrow-up-right, plus, clock, arrow-left-right, badge-check, cup (hangout), map (tour), crown, bell, flag (end), paper-plane (I've paid it), check, eye / eye-off, wallet, divide, calendar, users, search, user-plus, user-minus, pencil, paintbrush, log-out, sparkles, trash.

### 9.5 Components to build
`TwoToneTitle`, `PillButton` (full-width, purple by default, spinner state), `CircleIconButton`, `PillTextField` (icon + field on paper), `AmountField`, `ErrorBanner`, `AvatarView` (avatar SVG or initials), `AvatarPicker`, `StatusChip`, `StageTracker`, `BillRow`, `ExpenseRow`, `DayHeader`, `NoticeList`, `LiveSplitCard`, `HangoutHeaderCard`, `MemberStrip`, `ActiveHangoutCard`, `PastHangoutCard`, `CreateHangoutCard`, `JoinHangoutCard`, `StatTile`, `PeopleTile`, `UserRow`, `RadioRow`, `FriendToggleRow`, `SideMenu`, `BottomSheet`.

---

## 10. Motion and animation

From `ios-source/SplitMate/Views/Components/Motion.swift`. Three shared animations:

| Name | iOS | Web equivalent (Motion) | Use |
|------|-----|-------------------------|-----|
| spring | `response 0.45, damping 0.82` | `{ type: "spring", duration: 0.45, bounce: 0.18 }` (or `stiffness ≈ 195, damping ≈ 23`) | cards, lists, screens, menu |
| snappy | `response 0.28, damping 0.7` | `{ type: "spring", duration: 0.28, bounce: 0.3 }` (or `stiffness ≈ 500, damping ≈ 31`) | button press, avatar select |
| gentle | `easeInOut 0.2s` | `{ duration: 0.2, ease: "easeInOut" }` | everything when Reduce Motion is on |

Behaviours to reproduce:
- **Press-shrink:** every button scales to 0.96 and 85% opacity while pressed (snappy spring).
- **Staggered home entrance:** greeting, Create card, Join card and owe banner fade in and rise 18px, delays 0 / 0.05 / 0.10 / 0.15 s. Side menu tiles do the same (0.05, 0.10).
- **Lists glide:** when hangouts are added, end, or totals change, and when bills change status, rows animate to their new place; new rows slide in (active from top, past from bottom). Costs and reminders slide in. Use `AnimatePresence` + `layout`.
- **Count-up numbers:** hangout total, owe banner and stat tiles animate digit changes (iOS `numericText` transition). On the web, tween the number or roll the digits.
- **Side menu:** spring slide from the left plus fade; scrim fades; home scales to 0.94 behind it and ignores taps; **swipe left to close** (menu follows the finger, closes past −80px).
- **Bill stage change:** chip swaps with a pop (scale 0.8 → 1 + fade), tracker dots/lines fill in with the spring, the current dot is 1.15× larger, action buttons crossfade, plus a light haptic.
- **Forms:** the tour "Lasts N days" row and error banners animate in/out.
- **Sheets:** rounded top corners (28px) with a grab handle; Join sheet opens at half height and can be dragged to full.
- **Reduce Motion:** when `prefers-reduced-motion: reduce`, replace every slide/spring/scale with a 0.2 s fade (no 18px rise, no press scale, no home scale-down).

---

## 11. Known limits and improvements

These are limits of the current iOS app that a web build with a backend can fix.

1. **No server.** Tour day-end settling and the 2-hourly reminders run only when some member has the app open (checked every 60 s). If nobody opens it, the next person who does catches up. **Fix:** Cloud Functions:
   - Scheduled function (e.g. every 15 min): settle finished tour days for active tours, using the hangout's time zone.
   - Scheduled function (e.g. every 15 min): post reminder rounds for ended hangouts with unpaid bills and send a web push to each payer.
   - Optionally: an `endHangout` callable function that does the settling server-side, so clients can't write bills or `status` directly (§8).
2. **Reminders are in-app only.** Add FCM web push (needs notification permission; on iOS the PWA must be installed to the home screen first, iOS 16.4+). Keep the in-hangout notices too.
3. **Time zones:** day keys use each device's local zone. Store the hangout's zone (§4.3).
4. **Stats freshness:** `publicStats` updates only when the owner opens the side menu (§7).
5. **Privacy:** user emails are readable by all signed-in users (§8).
6. **Token collisions** aren't retried (§4.2).
7. **Late joiners** don't share costs added before they joined (by design, since `splitAmongIDs` is stored explicitly). Keep this.
8. **Ending with no costs** just ends the hangout with no bills ("Everyone paid their own share").
9. **Friend lists** load at most 30 friends per query; batch for more.
10. **No editing** of costs (delete and re-add), no currency other than taka, no receipts/photos, no password reset screen. All are reasonable additions (password reset is a one-liner with Firebase `sendPasswordResetEmail`).

---

## 12. Build order and acceptance checklist

Suggested milestones:
1. Project setup: Vite + React + TS, PWA manifest/service worker, design tokens, fonts, icon set, base components (§9.5).
2. Firebase project, rules from `firebase/firestore.rules`, auth (sign in/up, username reservation, avatar picker).
3. Home (cards, active/past lists, owe banner) + side menu shell.
4. Create hangout / tour, join with token.
5. Hangout screen: header, members, add/delete cost with split picker, live split.
6. Settling (port `reference/settlement.ts`), End, bills with stages.
7. Tours: day grouping, day-end settling (client first, then Cloud Function).
8. Reminders (client first, then Cloud Function + push).
9. Profiles, privacy toggle, member profiles, friends search.
10. Side menu stats + publicStats.
11. Motion pass (§10) including Reduce Motion.
12. Install/test on a real Android phone (Chrome) and iPhone (Safari → Add to Home Screen).

Acceptance checks (all should pass on Android Chrome and iOS Safari, installed and in-browser):
- [ ] Sign up rejects a taken username, bad email, short password with the exact messages in §3.2.
- [ ] Create a hangout; token shows with "valid until" 24 h later. A second account joins with it. After 24 h the token is refused with the expiry message.
- [ ] Create a 3-day tour; token valid until midnight after day 3.
- [ ] Add the worked example (§6) costs; live split shows D → B ৳450, C → A ৳150, C → B ৳100, with the viewer's own lines first and the viewer at the top of Balances.
- [ ] A cost split among 3 of 4 members charges only those 3.
- [ ] Only the creator sees End; ending creates exactly those bills, once, even if two devices try at the same moment.
- [ ] Payer can move Due → In progress; receiver can confirm; nobody else can (UI and rules).
- [ ] Past hangout card shows bills, chips and "N of M bills paid".
- [ ] A tour day closes after midnight and its costs become bills marked with that day; that day's costs can no longer be added or deleted.
- [ ] Reminder notices appear 2 h after ending for unpaid bills, then every 2 h, one round only.
- [ ] Hiding spending hides it on your member profile for others (rules refuse the read).
- [ ] Friend search by username prefix works; add/remove friend.
- [ ] All 8 avatars render everywhere; changing yours updates it inside your hangouts.
- [ ] Animations match §10; with Reduce Motion on, only fades.
- [ ] Layout works from 320px wide phones up; no horizontal scroll.

---

## 13. What's in this package

```text
SplitMate-web-handoff/
├── HANDOFF.md              this document
├── README.md               short index
├── mockups/                screen mockups (PNG); all-screens.png shows every screen
├── design-inspiration/     third-party mood images (reference only, do not ship)
├── avatars/                the 8 avatars as SVG + index.html preview
├── fonts/                  Fredoka, Nunito, Lilita One, Space Mono (TTF) + OFL licence files
├── firebase/firestore.rules  current security rules
├── reference/              settlement.ts + settlement.test.ts (TypeScript port, tested)
└── ios-source/             snapshot of the SwiftUI app (main @ 877170c) for reference
    ├── SplitMate/Models/        data types, SettlementCalculator, StatsCalculator, Validator
    ├── SplitMate/ViewModels/    Firebase logic (auth, hangouts, bills, friends, stats)
    ├── SplitMate/Views/         every screen and component, Theme.swift, Motion.swift
    └── README.md, firestore.rules, FontLicenses/
```

Where to look in the Swift code for a given behaviour:
| Behaviour | File |
|-----------|------|
| Colours, fonts, radii | `Views/Components/Theme.swift` |
| Animations | `Views/Components/Motion.swift`, `App/MainView.swift` (menu) |
| Settlement | `Models/SettlementCalculator.swift` |
| Stats | `Models/SpendingSummary.swift` |
| Validation messages | `Models/Validator.swift` |
| Token rules, create, join | `Models/Hangout.swift`, `ViewModels/HangoutListManager.swift` |
| Add/delete cost, end, tour day-end | `ViewModels/HangoutManager.swift` |
| Bill stages, reminders | `ViewModels/BillManager.swift` |
| Live split ordering | `Views/Hangouts/LiveSplitCard.swift` |
| Avatars | `Models/AvatarOption.swift`, `Views/Components/FaceAvatarView.swift` |
