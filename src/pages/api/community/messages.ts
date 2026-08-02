import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser, requireAdmin } from '@/lib/auth-utils';
import { badRequest, created, methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { communityConfig } from '@/config';
import {
  directory,
  ensureWelcomeMessage,
  notifyMentions,
  postMessage,
  readFeed,
  unreadCount
} from '@/lib/community';
import { strings } from '@/lib/i18n';
import { queryInt, queryString } from '@/lib/query';
import { findXssField } from '@/lib/xss';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) {
    return unauthorized(res, strings.community.signedOut);
  }

  const canMentionEveryone = requireAdmin(sessionUser);

  if (req.method === 'GET') {
    const after = queryString(req, 'after');
    const before = queryString(req, 'before');
    const limit = queryInt(req, 'limit', communityConfig.pageSize, 1, communityConfig.pageSize);

    await ensureWelcomeMessage(sessionUser);

    const feed = await readFeed({ after, before, limit });
    const incremental = Boolean(after);

    return ok(res, {
      ...feed,
      members: incremental ? undefined : await directory(),
      unreadCount: await unreadCount(sessionUser.id),
      currentUserId: sessionUser.id,
      canMentionEveryone,
      canModerate: canMentionEveryone,
      maxLength: communityConfig.maxMessageLength,
      pollIntervalMs: communityConfig.pollIntervalMs
    });
  }

  if (req.method === 'POST') {
    const { text } = req.body as { text?: string };
    const value = typeof text === 'string' ? text.trim() : '';

    if (!value) {
      return badRequest(res, strings.community.textRequired);
    }
    if (value.length > communityConfig.maxMessageLength) {
      return badRequest(res, strings.community.tooLong(communityConfig.maxMessageLength));
    }
    if (findXssField({ text: value })) {
      return badRequest(res, strings.errors.suspiciousInput);
    }

    const message = await postMessage({ authorId: sessionUser.id, text: value });
    await notifyMentions({ text: value, actorId: sessionUser.id, canMentionEveryone });

    return created(res, { message });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}

export default withAudit(handler);
