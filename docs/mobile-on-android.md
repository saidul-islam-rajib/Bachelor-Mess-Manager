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

## Dashboard on Android

- `mobile/src/features/dashboard/DashboardScreen.android.tsx` wraps the shared screen and sets a dark status bar on the white background. It imports the shared file by its full name so it does not import itself.
- Pull to refresh works as shared: the dashboard `ScrollView` has a `RefreshControl`, and Android shows its own spinner. Changing the spinner colour needs an edit in the shared screen, which ios owns.
- The hardware back button on the dashboard leaves the app, because the dashboard is the first screen after sign-in. No handler is added.

## Meals and quick reply on Android

- `mobile/src/features/meals/MealsScreen.android.tsx` wraps the shared screen and sets a dark status bar, like the dashboard. The Meals tab route imports `MealsScreen` without an extension, so Metro picks this file on Android.
- The quick reply card sits on Home inside the dashboard, so it already runs under the dashboard's Android wrapper. No separate file is needed.
- Pull to refresh and the horizontal day chips work as shared. The hardware back button on a tab goes back to the previous tab, then leaves the app; no handler is added.
- The tabs shell (`(app)/_layout.tsx`) is owned by ios. No Android-only change was needed there.

## Bazar, bills and payments on Android

- `BazarScreen.android.tsx`, `BillsScreen.android.tsx` and `PaymentsScreen.android.tsx` in `mobile/src/features/<feature>/` wrap the shared screens and set a dark status bar, like the dashboard and meals. The Money tab (`(app)/money.tsx`, owned by ios) imports them without an extension, so Metro picks these files on Android.
- All amounts come from the API as shown on iPhone; nothing is recomputed on the device.
- The hardware back button on the Money tab goes back to the previous tab, then leaves the app; no handler is added.

## Not checked in the sandbox

The sandbox has no Android SDK or phone, so on-device behaviour is tested by the owner. Agents run only the typecheck, lint and jest checks of ADR-003.
