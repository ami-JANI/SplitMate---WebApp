# SplitMate (web)

**Hang out. Split fair. Settle up.** An installable web app (PWA) for splitting the cost of hangouts with friends. It runs on Android, iPhone and desktop browsers.

It is a web rebuild of the SwiftUI iOS app, with its own Firebase project (`splitmate-web-76056`). The full spec it follows is in [`docs/HANDOFF.md`](docs/HANDOFF.md), and the screen mockups are in [`docs/mockups/`](docs/mockups).

## How it works

1. Create a **hangout** (one day) or a **tour** (2 to 30 days) and share its 6-character **join token**. You can also share a link, `/join/TOKEN`.
2. Friends join with the token, or any member adds them from the hangout screen by username or from their friends list. Anyone adds **costs**: what it was, how much, who paid, and who shares it.
3. A **live split** shows every balance and the fewest payments that settle them, with your own payments first.
4. When the creator **ends** it (or, for a tour, when **each day ends**), those payments become **bills**. Each bill moves **Due → In progress → Delivered**.
5. Anyone who still owes gets a reminder in the hangout every 2 hours.

## Stack

React 19 + TypeScript + Vite, Motion for animation, React Router, Lucide icons, and `vite-plugin-pwa`. The backend is Firebase: Authentication (email and password) and Cloud Firestore with offline cache. There are optional Cloud Functions for scheduled jobs.

```text
src/
  lib/          pure logic + tests: settlement, money, day keys, tokens, validation, stats
  data/         Firebase: auth, live lists, actions (create/join/costs/settle/bills/reminders/friends)
  components/   UI building blocks (buttons, sheets, bill rows, live split, ...)
  screens/      sign in/up, home, side menu, hangout, profiles, friends
  sheets/       create hangout, join, add a cost, choose avatar
firestore.rules         security rules (tests in tests/)
functions/              scheduled jobs: settle tour days, send reminders (Blaze plan)
public/                 fonts (OFL), avatars, PWA icons
```

## Run it locally

You need Node 20 or newer, and Java for the Firebase emulators.

```bash
npm install
npm run dev                     # http://localhost:5173 (uses the real project, config in .env)
```

**Without touching the real project:** create `.env.local` with `VITE_USE_EMULATORS=true`, then run `npm run emulators` in one terminal and `npm run dev` in another. The data is local and disappears when you stop the emulators.

To open it on your phone on the same Wi-Fi, run `npm run dev -- --host` and open the "Network" address it prints.

## Tests

```bash
npm test             # settlement maths, day keys, tokens, validation, stats
npm run test:rules   # Firestore security rules on the emulator
npm run typecheck
```

## Firebase setup (one time)

1. In the [Firebase console](https://console.firebase.google.com/project/splitmate-web-76056), enable **Authentication → Email/Password** and create the **Firestore Database**.
2. The web app config is already in `.env`.
3. Install the CLI and sign in: `npm install -g firebase-tools` and `firebase login`.
4. Deploy the rules and the app:

   ```bash
   npm run deploy        # builds, then deploys Firestore rules + Hosting
   ```

   The app is then live at `https://splitmate-web-76056.web.app`. You can install it from there: on Android use Chrome → "Add to Home screen", and on iPhone use Safari → Share → "Add to Home Screen".

### Optional: scheduled jobs (Blaze plan)

On the free Spark plan, the app settles finished tour days and posts reminders whenever a member has it open, the same way the iOS app does. If you upgrade to Blaze, `functions/` does both every 15 minutes on the server, so nothing waits for someone to open the app:

```bash
cd functions && npm install && cd ..
npm run deploy:functions
```

The app and the functions use the same transaction checks, so they never create duplicate bills or reminders.

## Differences from the iOS app

The handoff (§11) suggested these improvements, and the web build includes them:

- Money is stored as whole paisa (`amountCents`, `totalSpentCents`), so totals never drift.
- Each hangout stores its creator's time zone, and every member works out the day in that zone.
- Join tokens are checked for collisions and retried.
- Profiles hold no email, so searching them doesn't expose anyone's address.
- You can sign in with your username or your email. The email for a username is filed under a key made from the username and the password (`src/lib/loginKey.ts`), so only someone who knows both can find it. After a password reset, sign in with your email once to make the username work again.
- Tighter security rules:
  - members can only change the fields the app needs
  - only the creator can end a hangout
  - bills can only be created in the same write that settles their day
  - costs must be paid by members and split between members
- Password reset, sharing a join link, renaming yourself, and a visible "remove friend" button.

## Licences

The fonts (Fredoka, Nunito, Lilita One and Space Mono) use the SIL Open Font License 1.1. See `public/fonts/OFL-*.txt`.
