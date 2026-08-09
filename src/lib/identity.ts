import { isSessionSecretConfigured } from '@/lib/session';
import { sessionConfig } from '@/config';

/**
 * The cross-application session, shared with the other Team Sober apps.
 *
 * Every app is served from a subdomain of `team-sober.com` and signs this
 * cookie with the same `AUTH_SECRET`, so a cookie set on the parent domain is
 * readable by all of them and any app can verify a session another minted.
 * There are no redirects and no authorisation codes, and one app being down
 * never stops another signing somebody in.
 *
 * This file is the contract. It has to stay byte-compatible with
 * `team-sober/automation/src/shared/identity/identity.ts` — the encoding, the
 * claim names and the subject namespace are all load-bearing across repos.
 * Bachelor Point keeps its own `bp_session` as the authority on its own
 * sessions; this is strictly additional.
 */

export const IDENTITY_COOKIE = 'ts_identity';

export const IDENTITY_ISSUER = 'bachelor-point';

/** Namespaced so a hash of an address here cannot be replayed anywhere else. */
const SUBJECT_NAMESPACE = 'team-sober.com/identity/v1';

export type IdentityClaims = {
  /** Stable across every app, derived from the email address. */
  sub: string;
  email: string;
  name: string;
  /** Which application minted this token. */
  iss: string;
  /** The issuer's token version, for revoking its own sessions. */
  sv: number;
  iat: number;
  exp: number;
};

/**
 * Single sign-on is off entirely without a properly configured `AUTH_SECRET`.
 * Falling back to a development key would mean two apps with no configuration
 * silently trusting each other's sessions.
 */
export function ssoEnabled(): boolean {
  return isSessionSecretConfigured();
}

/**
 * The `Domain` for the shared cookie — `.team-sober.com` in production. Unset
 * locally, which makes it host-only and keeps a development session from
 * leaking between apps on different ports.
 */
export function identityCookieDomain(): string {
  return (process.env.SSO_COOKIE_DOMAIN ?? '').trim();
}

const encoder = new TextEncoder();

function encodeUtf8(value: string): ArrayBuffer {
  const bytes = encoder.encode(value);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function bytesToBase64Url(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i += 1) view[i] = binary.charCodeAt(i);
  return buffer;
}

let cachedKey: { secret: string; key: Promise<CryptoKey> } | null = null;

function signingKey(): Promise<CryptoKey> {
  const secret = sessionConfig.secret as string;

  if (!cachedKey || cachedKey.secret !== secret) {
    cachedKey = {
      secret,
      key: crypto.subtle.importKey('raw', encodeUtf8(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
        'sign',
        'verify'
      ])
    };
  }

  return cachedKey.key;
}

/**
 * The same address always yields the same subject, in any app, with no shared
 * table to look it up in. Shaped like a UUID so it reads like an id.
 */
export async function identityId(email: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    encodeUtf8(`${SUBJECT_NAMESPACE}:${email.trim().toLowerCase()}`)
  );

  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join('-');
}

export async function issueIdentity(user: {
  email: string;
  name: string;
  tokenVersion: number;
}): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);

  const claims: IdentityClaims = {
    sub: await identityId(user.email),
    email: user.email,
    name: user.name,
    iss: IDENTITY_ISSUER,
    sv: user.tokenVersion,
    iat: issuedAt,
    exp: issuedAt + sessionConfig.maxAgeSeconds
  };

  const body = bytesToBase64Url(encodeUtf8(JSON.stringify(claims)));
  const signature = await crypto.subtle.sign('HMAC', await signingKey(), encodeUtf8(body));

  return `${body}.${bytesToBase64Url(signature)}`;
}

function wellFormed(claims: Partial<IdentityClaims>): boolean {
  return (
    typeof claims.sub === 'string' &&
    Boolean(claims.sub) &&
    typeof claims.email === 'string' &&
    Boolean(claims.email) &&
    typeof claims.name === 'string' &&
    typeof claims.iss === 'string' &&
    Boolean(claims.iss) &&
    typeof claims.sv === 'number' &&
    typeof claims.iat === 'number' &&
    typeof claims.exp === 'number'
  );
}

/**
 * Decode the shared cookie *without* verifying its signature.
 *
 * Only for the middleware gate, which does exactly the same for `bp_session`:
 * cheap enough to run on every request, and synchronous. Letting a request
 * through proves nothing — it only means the request reaches a handler that
 * verifies properly before trusting anything.
 */
export function readIdentityClaims(token: string | undefined | null): IdentityClaims | null {
  if (!token) return null;

  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;

  try {
    const claims = JSON.parse(
      new TextDecoder().decode(base64UrlToBuffer(token.slice(0, dot)))
    ) as Partial<IdentityClaims>;

    if (!wellFormed(claims)) return null;

    const full = claims as IdentityClaims;

    return full.exp > Math.floor(Date.now() / 1000) ? full : null;
  } catch {
    return null;
  }
}

export async function readIdentity(token: string | undefined | null): Promise<IdentityClaims | null> {
  if (!token || !ssoEnabled()) return null;

  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;

  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await signingKey(),
      base64UrlToBuffer(signature),
      encodeUtf8(body)
    );
    if (!valid) return null;

    const claims = JSON.parse(new TextDecoder().decode(base64UrlToBuffer(body))) as Partial<IdentityClaims>;
    if (!wellFormed(claims)) return null;

    const full = claims as IdentityClaims;

    return full.exp > Math.floor(Date.now() / 1000) ? full : null;
  } catch {
    return null;
  }
}
