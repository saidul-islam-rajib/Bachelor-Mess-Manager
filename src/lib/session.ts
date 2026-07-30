import { isProduction, sessionConfig } from '@/config';

export const SESSION_COOKIE_NAME = sessionConfig.cookieName;
export const SESSION_MAX_AGE_SECONDS = sessionConfig.maxAgeSeconds;
export const SESSION_REFRESH_AFTER_SECONDS = sessionConfig.refreshAfterSeconds;

export type SessionPayload = {
  uid: string;
  sv: number;
  iat: number;
  exp: number;
};

const DEV_FALLBACK_SECRET = 'bachelor-point-insecure-development-secret-do-not-use-in-production';

export function isSessionSecretConfigured(): boolean {
  const secret = sessionConfig.secret;
  return Boolean(secret && secret.length >= sessionConfig.minSecretLength);
}

function getSecret(): string {
  if (isSessionSecretConfigured()) return sessionConfig.secret as string;

  if (isProduction) {
    throw new Error(
      `AUTH_SECRET is missing or shorter than ${sessionConfig.minSecretLength} characters. ` +
        'Generate one with: npx --yes node -e "process.stdout.write(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"'
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

export async function createSessionToken(userId: string, tokenVersion: number): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    uid: userId,
    sv: tokenVersion,
    iat: issuedAt,
    exp: issuedAt + sessionConfig.maxAgeSeconds
  };

  const body = bytesToBase64Url(encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', await getKey(), encode(body));
  return `${body}.${bytesToBase64Url(signature)}`;
}

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

export function readSessionClaims(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;

  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBuffer(token.slice(0, dot)))) as SessionPayload;

    if (typeof payload?.uid !== 'string' || !payload.uid) return null;
    if (typeof payload.exp !== 'number' || typeof payload.iat !== 'number') return null;
    if (typeof payload.sv !== 'number') return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

export function shouldRefresh(payload: SessionPayload): boolean {
  return Math.floor(Date.now() / 1000) - payload.iat > sessionConfig.refreshAfterSeconds;
}
