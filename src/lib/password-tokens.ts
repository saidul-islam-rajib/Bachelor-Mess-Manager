import crypto from 'node:crypto';
import type { NextApiRequest } from 'next';
import { prisma } from '@/lib/prisma';
import { appUrlConfig, passwordTokenConfig } from '@/config';
import { clientIp } from '@/lib/rate-limit';

export const TOKEN_PURPOSE = {
  SETUP: 'SETUP',
  RESET: 'RESET'
} as const;

export type TokenPurpose = (typeof TOKEN_PURPOSE)[keyof typeof TOKEN_PURPOSE];

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function publicBaseUrl(req: NextApiRequest): string {
  if (appUrlConfig.publicUrl) return appUrlConfig.publicUrl.replace(/\/+$/, '');

  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) ?? 'http';
  const host = req.headers.host ?? 'localhost';
  return `${proto}://${host}`;
}

export async function issuePasswordToken(params: {
  userId: string;
  purpose: TokenPurpose;
  req: NextApiRequest;
}): Promise<{ token: string; expiresAt: Date; link: string }> {
  const token = crypto.randomBytes(passwordTokenConfig.bytes).toString('base64url');
  const expiresAt = new Date(Date.now() + passwordTokenConfig.minutes * 60_000);

  await prisma.passwordToken.updateMany({
    where: { userId: params.userId, purpose: params.purpose, usedAt: null },
    data: { usedAt: new Date() }
  });

  await prisma.passwordToken.create({
    data: {
      userId: params.userId,
      tokenHash: hashToken(token),
      purpose: params.purpose,
      expiresAt,
      requestedIp: clientIp(params.req),
      publishedAt: new Date()
    }
  });

  const link = `${publicBaseUrl(params.req)}/auth/set-password?token=${token}`;
  return { token, expiresAt, link };
}

export type TokenLookup =
  | { ok: true; userId: string; tokenId: string; purpose: string; name: string; email: string }
  | { ok: false; error: string };

export async function findValidToken(token: unknown): Promise<TokenLookup> {
  if (typeof token !== 'string' || token.length < 20) {
    return { ok: false, error: 'That link is not valid.' };
  }

  const record = await prisma.passwordToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, name: true, email: true } } }
  });

  if (!record) return { ok: false, error: 'That link is not valid.' };
  if (record.usedAt) return { ok: false, error: 'That link has already been used.' };
  if (record.expiresAt.getTime() <= Date.now()) return { ok: false, error: 'That link has expired.' };

  return {
    ok: true,
    userId: record.userId,
    tokenId: record.id,
    purpose: record.purpose,
    name: record.user.name,
    email: record.user.email
  };
}

export async function consumeToken(tokenId: string) {
  await prisma.passwordToken.update({ where: { id: tokenId }, data: { usedAt: new Date() } });
}

export async function prunePasswordTokens() {
  const result = await prisma.passwordToken.deleteMany({
    where: { OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }] }
  });
  return result.count;
}
