// Session tokens.
//
// The session cookie used to be the bare user id, which meant anyone could type
// someone else's id into their browser and become that user. It is now a signed,
// expiring token:
//
//     base64url(payload) . base64url(HMAC-SHA256(secret, base64url(payload)))
//
// Only the server knows AUTH_SECRET, so the payload cannot be forged or edited.
// It is still readable by the client — it carries no secrets, just the user id,
// a token version, and timestamps.
//
// Everything here uses the Web Crypto API (not node:crypto) because Next.js
// middleware runs on the edge runtime. The same module therefore works in both
// middleware and API routes.

export const SESSION_COOKIE_NAME = 'mess_session';

/** 30 days, matching the cookie's Max-Age. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Re-issue the cookie when the token is more than a day old, so an active user's
 * session slides forward instead of expiring mid-use.
 */
export const SESSION_REFRESH_AFTER_SECONDS = 60 * 60 * 24;

export type SessionPayload = {
  /** User id. */
  uid: string;
  /** User's tokenVersion at sign-in; bumped on password change to revoke old sessions. */
  sv: number;
  /** Issued at (seconds since epoch). */
  iat: number;
  /** Expires at (seconds since epoch). */
  exp: number;
};

const DEV_FALLBACK_SECRET = 'bachelor-point-insecure-development-secret-do-not-use-in-production';

let warnedAboutSecret = false;

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;

  if (secret && secret.length >= 32) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'AUTH_SECRET is missing or too short. Set a random value of at least 32 characters ' +
        '(for example: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))").'
    );
  }

  if (!warnedAboutSecret) {
    warnedAboutSecret = true;
    // eslint-disable-next-line no-console
    console.warn(
      '[auth] AUTH_SECRET is not set (or is shorter than 32 chars). Falling back to an ' +
        'insecure development secret. Add AUTH_SECRET to .env before deploying.'
    );
  }
  return DEV_FALLBACK_SECRET;
}

const encoder = new TextEncoder();
const keyCache = new Map<string, Promise<CryptoKey>>();

function getKey(): Promise<CryptoKey> {
  const secret = getSecret();
  let key = keyCache.get(secret);
  if (!key) {
    key = crypto.subtle.importKey('raw', encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
    keyCache.set(secret, key);
  }
  return key;
}

function bytesToBase64Url(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Returns an ArrayBuffer rather than a typed array: it is what both
// `crypto.subtle` and `TextDecoder` want, and it sidesteps the ArrayBufferLike
// variance that trips up typed-array arguments.
function base64UrlToBuffer(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i += 1) view[i] = binary.charCodeAt(i);
  return buffer;
}

function encode(value: string): ArrayBuffer {
  const bytes = encoder.encode(value);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Create a signed session token for a user. */
export async function createSessionToken(userId: string, tokenVersion: number): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    uid: userId,
    sv: tokenVersion,
    iat: issuedAt,
    exp: issuedAt + SESSION_MAX_AGE_SECONDS
  };

  const body = bytesToBase64Url(encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', await getKey(), encode(body));
  return `${body}.${bytesToBase64Url(signature)}`;
}

/**
 * Verify a token's signature and expiry.
 * Returns the payload, or null for anything malformed, forged, or expired.
 * Never throws — a bad cookie is simply "not signed in".
 */
export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;

  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;

  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  try {
    const valid = await crypto.subtle.verify('HMAC', await getKey(), base64UrlToBuffer(signature), encode(body));
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBuffer(body))) as SessionPayload;

    if (typeof payload?.uid !== 'string' || !payload.uid) return null;
    if (typeof payload.exp !== 'number' || typeof payload.iat !== 'number') return null;
    if (typeof payload.sv !== 'number') return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

/** True once the token is old enough that we should hand out a fresh one. */
export function shouldRefresh(payload: SessionPayload): boolean {
  return Math.floor(Date.now() / 1000) - payload.iat > SESSION_REFRESH_AFTER_SECONDS;
}
