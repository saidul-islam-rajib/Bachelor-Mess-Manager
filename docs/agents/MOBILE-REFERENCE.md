# Mobile reference

The owner already runs another Expo app, CareerPilot, on an iPhone. This file records what works there so the Bachelor Point app copies it instead of guessing. CareerPilot lives on the owner's machine, not in this repo, so everything needed is written down here.

## How the owner tests

- The owner tests on an iPhone first. Android comes later.
- Assume no paid Apple Developer account. The app runs in **Expo Go** from the App Store: the iPhone and the laptop are on the same Wi-Fi, `npx expo start` runs in the mobile app folder, and the owner scans the QR code with the iPhone camera.
- So the app may use only modules that Expo Go already bundles. No custom native code, no config plugin that needs a development build, and no `ios/` or `android/` folders.
- The backend runs on the same laptop. `npm run dev` serves it on port 3000, or Docker Compose serves it on port 8080. The iPhone reaches it at `http://<laptop Wi-Fi address>:<port>`. Windows Firewall must allow that port on private networks.
- `GET /api/health` answers when the backend is up.

## Server address in the app

- `app.config.ts` reads the API address from the environment variable `MESS_API_URL` and puts it in `extra`.
- The sign-in screen shows **Server: <address> · Change** in development. The owner types the laptop address and taps **Check and save**. The app calls `/api/health` before switching, and keeps the address in secure storage. Production builds hide this.
- Allow plain `http://` only when the address starts with `http://`. Store builds point at `https://` and stay locked down.

## Versions

Use Expo SDK 58. The owner's Expo Go runs it today, and Expo Go opens only the SDK it was built for. These versions run together in CareerPilot:

| Package | Version |
|---|---|
| expo | ~58.0.19 |
| expo-router | ~58.0.26 |
| react, react-dom | 19.3.0 |
| react-native | 0.88.0 |
| expo-secure-store | ~58.0.2 |
| expo-constants | ~58.0.13 |
| expo-status-bar | ~58.0.4 |
| expo-splash-screen | ~58.0.11 |
| react-native-safe-area-context | ~5.10.1 |
| react-native-screens | ~4.30.0 |
| react-native-gesture-handler | ~3.3.0 |
| react-native-reanimated | 4.7.1 |
| react-native-worklets | 0.13.0 |
| @tanstack/react-query | ^5.104.4 |
| zod | ^4.6.7 |
| typescript | ~6.0.3 |
| jest | ~30.5.2 |
| jest-expo | ~58.0.12 |
| @testing-library/react-native | ^14.1.0 |
| @types/react | ~19.3.0 |

Add packages with `npx expo install <package>`, never with plain `npm install`, so versions match the SDK. If the App Store's Expo Go moves to a newer SDK, the upgrade is its own board task.

Expo changes between SDKs. Read `https://docs.expo.dev/versions/v58.0.0/` and `https://docs.expo.dev/llms.txt` for the API you are using instead of relying on memory.

## Layout that works

- `src/app/` holds Expo Router routes only. `(auth)/` holds sign-in screens and `(app)/` the signed-in tabs. `_layout.tsx` files define the navigators.
- `src/features/<feature>/` holds each screen with its `*.spec.tsx` test beside it.
- `src/core/` holds `config` (reads `expo-constants` extra), `storage` (a small key-value interface over `expo-secure-store`, with a `.web.ts` fallback), `providers` (React Query client, auth session) and `theme`.
- `tsconfig.json` extends `expo/tsconfig.base` with `strict: true` and the alias `@/*` → `./src/*`.
- Server data goes through React Query. Every response is parsed with zod before the screen uses it.
- Session tokens live only in `expo-secure-store`, never in plain storage.
- User text lives in a locale file, including the permission texts that `app.config.ts` passes to plugins.

## Tests that work on Linux

- `package.json` jest config: preset `jest-expo`, `testMatch` `<rootDir>/src/**/*.spec.ts?(x)`, `moduleNameMapper` `^@/(.*)$` → `<rootDir>/src/$1`, and a `transformIgnorePatterns` entry that lets `react-native`, `@react-native`, `expo`, `@expo`, `expo-router` and `react-native-reanimated` through.
- `jest.setup.ts` loads `react-native-gesture-handler/jestSetup`, mocks `react-native-reanimated` with its own mock, mocks `expo-secure-store` with an in-memory Map, mocks `expo-constants` with an empty `extra`, and mocks `expo-router` (`useRouter`, `useLocalSearchParams`, `Stack`, `Tabs`, `Link`).
- Screens are tested with `@testing-library/react-native` against a mocked fetch. Tests never call a real server.

## Releases later

- When store builds are wanted, `eas.json` gets a `preview` profile (internal distribution, Android `apk`) and a `production` profile (`autoIncrement`, Android `app-bundle`), with `cli.appVersionSource` set to `remote`.
- The owner creates the Expo project and runs every `eas` command. Agents never run `eas build`, `eas submit` or `expo prebuild`.
- Never commit `google-services.json`, service-account keys, signing files or `.env`. This repo is public.
