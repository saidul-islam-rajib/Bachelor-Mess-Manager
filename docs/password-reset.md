# Forgot password

The `PasswordToken` table already carried a `purpose` column with `SETUP` and `RESET`, and `/auth/set-password` already
consumed either. Only `SETUP` was ever issued, by an admin from the users table. The missing piece was a way for a
member to ask for a `RESET` themselves.

## The flow

1. `/auth/forgot-password` posts an email to `POST /api/auth/forgot-password`.
2. The endpoint issues a `RESET` token via `issuePasswordToken`, which also marks any earlier unused token of the same
   purpose as used — so only the newest link works.
3. `passwordResetEmail` goes out, pointing at `/auth/set-password?token=…`.
4. The set-password page reads the token's purpose from the existing `GET /api/auth/set-password` and switches its copy
   to reset wording.
5. `POST /api/auth/set-password` writes the new hash, bumps `tokenVersion` (killing every other session), consumes the
   token, and signs the member in if their status is `APPROVED`.

## Enumeration and abuse

The response is deliberately uniform. An unknown address, a malformed address, a rejected account, and a real member
all return the same `{ sent: true }` body. Nothing in the status code or timing distinguishes them.

Three limits stack on top:

- per IP, 10 requests / 15 min — cuts off scanning
- per email, 3 requests / 15 min — cuts off mailbox flooding, and returns the same uniform body when tripped
- the global write-rate limiter in `withAudit`

`REJECTED` accounts get no email. Every other status does, including `PENDING` — resetting a password on an account
still awaiting approval is harmless, and the set-password response tells them they still need approval to sign in.

## The dev-mode link

When SMTP is not configured, `sendMail` only pushes to the in-memory outbox, which would make the flow untestable
locally. The endpoint therefore returns the raw link in the response — but **only when `NODE_ENV !== 'production'`**.

That guard matters. Registration can safely echo a setup link for an address the caller just proved they control; a
reset link echoed for an arbitrary address is account takeover for anyone who deploys without SMTP. If mail is
unconfigured in production the request still succeeds silently and no link is returned.

## Routes

`/auth/forgot-password` and `/api/auth/forgot-password` are both in `PUBLIC_PATHS` in `src/middleware.ts`, since a
signed-out member is the entire point.
