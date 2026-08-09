import { isSessionSecretConfigured } from '@/lib/session';
import { sessionConfig } from '@/config';

export const IDENTITY_COOKIE = 'ts_identity';

export const IDENTITY_ISSUER = 'bachelor-point';

const SUBJECT_NAMESPACE = 'team-sober.com/identity/v1';

export type IdentityClaims = {
  sub: string;
  email: string;
  name: string;
  iss: string;
  sv: number;
  iat: number;
  exp: number;
};

export function ssoEnabled(): boolean {
  return isSessionSecretConfigured();
}

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
