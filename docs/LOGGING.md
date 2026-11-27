# Logging

Every API request, lib call and client failure is written as one JSON line to stdout. Decision record: ADR-008 in `docs/agents/DECISIONS.md`.

## Line shape

`{ ts, level, event, src, rid, uid, ...fields }`

- `src` is `api` on the server, `cron` for the cron loop, and `web`, `ios` or `android` for client lines (also `client: true`).
- `rid` is the request id. A client may send `x-request-id` (8 to 64 characters of `A-Za-z0-9._-`); otherwise the server makes one. It is returned in the `x-request-id` response header and appears on every line the request caused.
- `uid` is the signed-in user, from the cookie session or the mobile bearer token.

## Events

- `api.start`, `api.end` (`status`, `ms`; `warn` for 4xx, `error` for 5xx), `api.error` (handler threw), `api.denied` (middleware 401).
- `fn.start` (debug), `fn.end`, `fn.error` from `traced(name, fn)` in `src/lib/log.ts`.
- `bootstrap.error`, `cron.start`, `cron.run`, `cron.fail`.

## Levels and redaction

`LOG_LEVEL` is `debug`, `info` (default), `warn` or `error`. Keys containing `password`, `token`, `secret`, `authorization`, `cookie`, `otp`, `apikey`, `p256dh`, or exactly `auth` or `code`, are replaced with `[redacted]`, and `Bearer` tokens are masked. New secret fields must use one of those names.

## Following the stream

    docker compose logs -f app cron
    sudo k3s kubectl -n bachelor-point logs -f -l app=bachelor-point --prefix --max-log-requests 10

Check: `node scripts/check-logging.js`.
