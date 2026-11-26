# Decisions

Owned by `architect`. Other agents read it and never edit it. To challenge a decision, leave a message for `architect` on the board.

The owner can overrule any decision by editing it here. Agents follow whatever this file says.

Each decision uses this shape:

    ## ADR-NNN: <title>
    Status: proposed | accepted | superseded by ADR-MMM
    Context: the facts from this repo that matter
    Options: what was weighed, with the main trade-off of each
    Decision: what was chosen
    Consequences: what this makes easier and harder
    Checks: the exact commands agents run to verify work in this area

Android and ios work starts only from `accepted` decisions.

## ADR-001: Mobile stack
Status: accepted
Context: One person owns and runs Bachelor Point. The web is Next.js 14 with React and TypeScript, and almost every member opens it on a phone (`docs/meal-rate-on-mobile.md`). `system-design.md` already names React Native or Flutter for mobile. The android and ios agents run in a Linux cloud sandbox with Node 22 and npm, no macOS, no Xcode, no emulator and maybe no Android SDK, so every check they run must work on plain Linux. The board has separate android and ios agents, so whatever is chosen must let two agents work without stepping on each other.
Options:
- Native Kotlin and Swift: best platform fit, but two codebases in two new languages for one maintainer, every feature built twice, and Swift UI code cannot be compiled or tested on Linux, so the ios agent could verify nothing in its sandbox.
- Kotlin Multiplatform with native UI: shares logic, but the SwiftUI half still needs a Mac for every check and the build tooling is the heaviest of the options to keep running.
- Flutter: one codebase and `flutter analyze` and `flutter test` run on Linux, but Dart shares no code, types or tooling with the TypeScript web and adds a second language and SDK to maintain.
- React Native with Expo and TypeScript: one codebase in the language the owner already maintains, same npm tooling as the web, typecheck, lint and unit tests run on plain Linux, and EAS Build and EAS Submit build, sign and upload iOS and Android binaries in the cloud without a Mac.
Decision: React Native with Expo (managed workflow, Expo Router, TypeScript strict), one app for Android and iOS, built to `docs/agents/MOBILE-REFERENCE.md`. Pin Expo SDK 58, not the latest SDK, because the owner tests in Expo Go on an iPhone and Expo Go opens only the SDK it was built for; use exactly the package versions in the reference table and add packages only with `npx expo install`. Moving to a newer SDK is its own board task, raised only when the App Store's Expo Go moves. The app uses only modules that Expo Go bundles: no custom native code, no config plugin or library that needs a development build, and no committed `android/` or `ios/` folders. Native config lives in `app.config.ts`. `app.config.ts` reads the backend address from `MESS_API_URL` into `extra`; in development the sign-in screen shows the server address with a Change action, checks `GET /api/health` before saving, and keeps the address in `expo-secure-store`; production builds hide it. Plain `http://` is allowed only for an `http://` address in development; store builds use `https://`. The first and main test path is Expo Go on the owner's iPhone against the backend on the laptop over Wi-Fi; Android comes later on the same codebase. Store builds come later through EAS Build and EAS Submit with the `eas.json` profiles in the reference; the owner creates the Expo project, holds the Apple and Google accounts and EAS-managed signing credentials, and runs every `eas` command by hand. Nothing builds or releases from `agents/*`. UI text lives in the app's own locale file, the mobile counterpart of `src/lib/i18n/locales/en.ts`. The app talks to the backend only over the HTTP API defined by ADR-002 and does not import from the web `src/`.
Consequences: One codebase and one language for both stores, agents verify everything on Linux, and the owner can open every change in Expo Go with no Apple Developer account and no build. The price is the Expo Go module limit: a feature that needs a native module outside Expo Go (for example push notifications on iOS) needs a development build and an Apple account, so it is a deliberate board task and an owner decision, never a side effect. Both agents touch one codebase, so ADR-003 splits ownership by path to avoid conflicts. On-device testing happens only on the owner's phone, not in the sandbox. Agents never start EAS builds.
Checks: in the mobile app directory set by ADR-003: `npm ci --no-audit --no-fund && npx tsc --noEmit && npx eslint . && npx jest --ci && npx expo-doctor`. jest uses the `jest-expo` preset and `jest.setup.ts` mocks from MOBILE-REFERENCE.md; tests never call a real server. Agents never run `eas build`, `eas submit` or `expo prebuild`.
