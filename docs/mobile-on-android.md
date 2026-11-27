# Mobile app on Android

The Bachelor Point app is one Expo codebase for iPhone and Android (ADR-001). This page is for running it on an Android phone in Expo Go against the backend on your laptop. The iPhone steps are in `docs/mobile-on-iphone.md`.

## Run it

1. Install **Expo Go** from Google Play. It must support Expo SDK 58, the same SDK the app pins.
2. Put the phone and the laptop on the same Wi-Fi.
3. Start the backend on the laptop: `npm run dev` (port 3000) or Docker Compose (port 8080). Allow that port on private networks in the laptop firewall.
4. In `mobile/`: `MESS_API_URL=http://<laptop Wi-Fi address>:3000 npx expo start`, then scan the QR code with the Expo Go app.
5. On the sign-in screen, check the line `Server: <address>`. If it is wrong, tap **Change**, type the address and tap **Check and save**. The app calls `/api/health` first.

## Android specifics

- Expo Go allows plain `http://` to your laptop. Store builds use `https://` only (ADR-001).
- The Android emulator reaches the laptop at `http://10.0.2.2:3000`, not `localhost`. A physical phone needs the laptop's Wi-Fi address.
- Android settings live in `mobile/config/android.ts` and are spread into the `android` block of `app.config.ts` by the ios agent (board task I4). Until then Expo Go runs with the defaults.
- `usesCleartextTraffic` is not set there: it needs the `expo-build-properties` plugin, which ADR-001 does not allow before a development build exists. Expo Go does not need it. Raise a board task before the first store build.
- Platform fixes go in `*.android.tsx` files beside the shared screen, never in separate folders.

## Not checked in the sandbox

The sandbox has no Android SDK or phone, so on-device behaviour is tested by the owner. Agents run only the typecheck, lint and jest checks of ADR-003.
