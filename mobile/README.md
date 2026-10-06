# Fintrack mobile

The Fintrack app for iOS and Android: the same design, features and backend as the web app, built with
React Native.

> Status: design direction. The screens below are mocks to agree on the look before building.

## Direction

- **Same design.** The web app's tokens, colour for colour (warm ivory and forest green in light; blue-black with
  emerald and mint in dark), Newsreader for headlines, Inter for figures and interface text, and the same SVG
  landscapes. Change figures carry the same small sparkline ("↓ 17% vs. this point last month").
- **Numbers first.** Home opens on net worth with its chart, then this month's spending, saving and investing; the
  mood line and its landscape come after the numbers.
- **Built for a phone.** Five tabs, each a group of features switched with a control at the top:
  - **Home**
  - **Money**: Accounts · Activity · Spending · Family
  - **+**: Quick add, a bottom sheet with its own keypad (with the decimal comma for Romanian amounts), so typing an
    amount never hides the categories: type, tap a category, done
  - **Plan**: Goals · Projections · Invest
  - **Insights**: For you · Reports

  Your profile and settings sit apart from the features, behind your photo at the top of Home.
- **Native touches.** Face ID / fingerprint sign-in and app lock, haptics on save, pull to refresh, system dark mode,
  and photo picking from the camera or library.
- **Same backend.** The Spring Boot API and its JWT sessions, unchanged. Profile photos use the same presigned
  upload to Cloudflare R2.

## Mock screens

Home · Quick add · Money › Accounts · Money › Spending · Plan › Goals · Insights · Profile & settings · Sign in · Home in dark mode.

## Planned stack

| Need | Choice |
|---|---|
| App framework | Expo (React Native, TypeScript), expo-router for tabs and stacks |
| Shared logic | `@ft/core` from this monorepo: the same reports, insights, projections and goal plans as the web app |
| Data | TanStack Query against the same REST API (`EXPO_PUBLIC_API_URL`) |
| Session | JWT in `expo-secure-store`; Face ID via `expo-local-authentication` |
| Drawing | `react-native-svg` for charts, sparklines and the illustrations |
| Motion | `react-native-reanimated`: staggered entrances, count-up figures, self-drawing sparklines; off when the system asks for reduced motion |
| Fonts | `@expo-google-fonts/newsreader` and `@expo-google-fonts/inter` |
| Photos | `expo-image-picker` + `expo-image-manipulator` (512px WebP), then the R2 upload flow |
| Tests | `jest-expo` with React Native Testing Library; Maestro for end-to-end flows |
| Builds | EAS Build for the App Store and Play Store; Expo Go while developing |
