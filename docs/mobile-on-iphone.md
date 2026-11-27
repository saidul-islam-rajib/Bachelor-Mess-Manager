# Bachelor Point app on your iPhone

How to run the backend on your laptop and open the mobile app on your iPhone in Expo Go. No Apple Developer account and no build are needed. The app lives in `mobile/` and uses Expo SDK 58 (see `docs/agents/MOBILE-REFERENCE.md`).

## What you need

- The laptop and the iPhone on the same Wi-Fi.
- Node 22 and npm on the laptop.
- **Expo Go** from the App Store on the iPhone. It must open SDK 58 projects. If Expo Go has moved to a newer SDK and refuses the app, tell the board; an SDK upgrade is its own task.
- The backend's `.env` filled in (`AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DATABASE_URL`). See `.env.example`.

## 1. Run the backend on the laptop

Pick one way, from the repository root.

Docker (port 8080, or `APP_PORT` from `.env`):

```powershell
docker compose up -d --build
```

Or the dev server (port 3000):

```powershell
npm ci
npm run dev
```

Check it on the laptop: <http://localhost:8080/api/health> (or port 3000). It answers when the backend is up.

## 2. Find the laptop's Wi-Fi address

```powershell
ipconfig
```

Use the `IPv4 Address` of the Wi-Fi adapter, for example `192.168.1.23`. The server address for the app is then `http://192.168.1.23:8080` (Docker) or `http://192.168.1.23:3000` (dev server).

## 3. Let the iPhone reach the port

Windows Firewall must allow the port on private networks. In PowerShell as administrator:

```powershell
New-NetFirewallRule -DisplayName "Bachelor Point 8080" -Direction Inbound -Protocol TCP -LocalPort 8080 -Profile Private -Action Allow
```

Use `3000` for the dev server, and also allow Expo's port `8081` the same way. Make sure the Wi-Fi network is set to Private.

Test: open `http://<laptop address>:<port>/api/health` in Safari on the iPhone. If it does not answer, fix this step before going on.

## 4. Start the app

```powershell
cd mobile
npm ci
$env:MESS_API_URL = "http://192.168.1.23:8080"
npx expo start
```

Set `MESS_API_URL` to your address from step 2. You can also leave it out and type the address in the app (step 5).

Scan the QR code with the iPhone camera and open it in Expo Go. If the phone cannot find the laptop, run `npx expo start --tunnel` instead.

## 5. Sign in

1. The sign-in screen shows **Server: <address> · Change** in development.
2. If the address is wrong, tap **Change**, type the laptop address with `http://`, and tap **Check and save**. The app calls `/api/health` first and keeps the address on the phone.
3. Sign in with your Bachelor Point email and password (for example the `ADMIN_EMAIL` account).

The app signs in through `POST /api/mobile/v1/auth/login` and sends the returned token as a bearer header on later requests. The token is kept in the iPhone's secure storage.

## If something fails

| Symptom | Check |
|---|---|
| "Cannot reach the server." | Same Wi-Fi? Firewall rule? Address starts with `http://` and has the port? Safari on the phone opens `/api/health`? |
| "That server did not answer." | Backend running? Right port (8080 Docker, 3000 dev server)? |
| Expo Go will not open the project | Expo Go SDK is not 58. Tell the board. |
| "Email or password is wrong." | Use the account from the backend database. |
| "Too many attempts." | Wait, the backend's login lockout applies. |

## Keeping this file true

The ios agent updates this file whenever a change alters these steps (ports, environment variables, sign-in, new setup). Store builds use `https://` and hide the server address; they are the owner's manual `eas` steps and are not covered here.
