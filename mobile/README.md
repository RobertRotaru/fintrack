# Fintrack mobile

The Fintrack app for iOS and Android: the same design, features and backend as the web app, built with
React Native.

> Status: design direction. The screens below are mocks to agree on the look before building.

## Direction

- **Same design.** The web app's tokens, colour for colour (warm ivory and forest green in light; blue-black with
  emerald and mint in dark), Newsreader for headlines, Inter for figures and interface text, and the same SVG
  landscapes. Change figures carry the same small sparkline ("↓ 17% vs. this point last month").
- **Built for a phone.** Five tabs: Home · Accounts · **+** · Goals · More. The + opens Quick add as a bottom sheet
  with its own keypad (with the decimal comma for Romanian amounts), so typing an amount never hides the categories:
  type, tap a category, done. Spending, Reports, Insights, Projections, Invest, Family and Settings live under More,
  alongside your profile.
- **Native touches.** Face ID / fingerprint sign-in and app lock, haptics on save, pull to refresh, system dark mode,
  and photo picking from the camera or library.
- **Same backend.** The Spring Boot API and its JWT sessions, unchanged. Profile photos use the same presigned
  upload to Cloudflare R2.

## Mock screens

Home · Quick add · Spending · Accounts · Goals · Profile & More · Sign in · Home in dark mode.

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
