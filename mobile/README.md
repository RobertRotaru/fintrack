# Fintrack mobile

The Fintrack app for iPhone (and Android), built with React Native and Expo. It has the same design and features
as the web app and talks to the same Spring Boot API, so your accounts, transactions, goals and family are the
same on every device.

## Run it on your iPhone

You need the repository on your computer, and your iPhone and computer on the **same Wi-Fi**.

1. On the iPhone, install **Expo Go** from the App Store.
2. On the computer, from the repository root:

   ```bash
   git checkout mobile-app
   npm install
   npm run dev          # the API on :4000 (and the web app); needs PostgreSQL, as in the main README
   ```

3. In a second terminal, also from the repository root:

   ```bash
   npm run mobile
   ```

   A QR code appears in the terminal.
4. Open the iPhone **Camera**, point it at the QR code and tap **Open in Expo Go**. The first load takes a minute;
   after that, saving a file reloads the app instantly.
5. Sign in with your account, or create one. The sign-in screen shows which server the app is using.

The app finds the API on its own: it uses the computer that is running `npm run mobile`, on port 4000.

**On Windows**, allow the connections the first time Windows asks (for Node.js, which serves the app, and for Java,
which runs the API), on **private networks**. If the iPhone can't reach the API ("Can't reach Fintrack"):

- make sure your Wi-Fi is set as a **Private** network (Settings → Network & internet → Wi-Fi → your network);
- or open the port from an administrator PowerShell:
  `netsh advfirewall firewall add rule name="Fintrack API" dir=in action=allow protocol=TCP localport=4000`

**Using the deployed API instead** (no computer running the API, or a network that blocks devices from seeing each
other): point the app at it before starting.

```powershell
$env:EXPO_PUBLIC_API_URL = "https://your-fintrack.ondigitalocean.app"; npm run mobile        # PowerShell
```

```bash
EXPO_PUBLIC_API_URL=https://your-fintrack.ondigitalocean.app npm run mobile                   # macOS / Linux
```

If the phone and computer can't be on the same network at all, `npx expo start --tunnel` (inside `mobile/`) serves
the app over the internet; combine it with `EXPO_PUBLIC_API_URL` set to the deployed API.

> **Face ID** works inside Expo Go: turn it on under your photo → Security → Lock with Face ID.
>
> **A real app icon on your home screen** (without Expo Go) needs a build signed by Apple: `npx eas-cli build
> --platform ios`, which requires an Apple Developer account. Expo Go is the free way to use it day to day.

## What's in it

Five tabs: **Home · Money · + · Plan · Insights**, each a group of features switched at the top.

- **Home**: net worth with its chart (1M to All), how you're doing in one line over the landscape, this month's
  spending, saving and investing with their trend lines, what needs your attention, this month in numbers, your
  goals and recent activity. Pull down to refresh.
- **+ (Quick add)**: type an amount on the keypad (with your phone's decimal separator) and tap a category to save.
  Change the account, the day or add a note on the way. Tap any transaction to edit or delete it in the same sheet.
- **Money**: Accounts (balances grouped by type, debts, credit used, 30-day trend), Activity (every transaction by
  day, with search), Spending (by category, against the same point last month) and Family (members, shared
  accounts and goals, invite by code).
- **Plan**: Goals (progress, what to save each month, add money), Projections (the next six months and the bills
  that repeat) and Invest (your habits and the AI coach).
- **Insights**: For you (last month in one line, then what's worth knowing) and Reports (any month in numbers,
  six-month income and spending).
- **Your photo** (top of Home): profile photo (camera or library, uploaded straight to Cloudflare R2), name and
  bio; main currency, country, appearance (system, light, dark), categories; Face ID lock; sign out.

The design is the web app's, token for token: warm ivory and forest green in light mode, blue-black with emerald and
mint in dark, Newsreader for headlines and Inter for figures, and the same hand-drawn landscapes. Sections rise in
one after another and the net worth counts up; all motion stops when the phone asks for reduced motion.

## How it's built

| Need | Choice |
|---|---|
| App | Expo SDK 57 (React Native 0.86), TypeScript, Expo Router (`src/app/`, one file per screen) |
| Logic | `@ft/core` from this repository: the same reports, insights, projections, goal plans and amount parsing as the web app |
| Data | TanStack Query against the REST API; the session token in the iOS Keychain (`expo-secure-store`) |
| Drawing | `react-native-svg` for charts, sparklines and illustrations; `lucide-react-native` for icons |
| Native | Face ID (`expo-local-authentication`), haptics, photo picker and resizing, system dark mode |
| Motion | `react-native-reanimated` |

```
mobile/
├─ src/app/          Screens and navigation (Expo Router)
│  ├─ (tabs)/        Home, Money, Plan, Insights and the tab bar with the + button
│  ├─ quick-add.tsx  The + sheet (also edits a transaction)
│  └─ profile.tsx    Your photo, settings and Face ID
├─ src/features/     The sections inside Money and Plan
├─ src/components/   Design system: text styles, cards, charts, illustrations
├─ src/lib/          API client, session, queries, theme tokens, Face ID lock, photo upload
└─ test/             Jest + React Native Testing Library
```

## Checks

```bash
npm run typecheck -w mobile
npm test -w mobile                                   # quick add, home, Face ID lock, photo upload, helpers
npx expo export --platform ios --output-dir dist-ios  # inside mobile/: builds the bundle Expo Go loads
npm run web -w mobile                                # the same app in a browser, for a quick look
```
