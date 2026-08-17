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
import { saveImage } from '@/lib/uploads';
import { findXssField } from '@/lib/xss';
import { withAudit } from '@/lib/with-audit';

export const config = {
  api: {
    bodyParser: { sizeLimit: '54mb' }
  }
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionUser = await getSessionUser(req, res);

  if (req.method === 'GET') {
    const after = queryString(req, 'after');
    const before = queryString(req, 'before');
    const limit = queryInt(req, 'limit', communityConfig.pageSize, 1, communityConfig.pageSize);
    const canMentionEveryone = sessionUser ? requireAdmin(sessionUser) : false;

    if (sessionUser) await ensureWelcomeMessage(sessionUser);

    const feed = await readFeed({ after, before, limit });
    const incremental = Boolean(after);

    return ok(res, {
      ...feed,
      members: incremental ? undefined : await directory(),
      unreadCount: sessionUser ? await unreadCount(sessionUser.id) : 0,
      currentUserId: sessionUser?.id ?? null,
      canMentionEveryone,
      canModerate: canMentionEveryone,
      maxLength: communityConfig.maxMessageLength,
      maxImagesPerPost: communityConfig.maxImagesPerPost,
      pollIntervalMs: communityConfig.pollIntervalMs
    });
  }

  if (!sessionUser) {
    return unauthorized(res, strings.community.signedOut);
  }

  const canMentionEveryone = requireAdmin(sessionUser);

  if (req.method === 'POST') {
    const { text, images } = req.body as { text?: string; images?: unknown };
    const value = typeof text === 'string' ? text.trim() : '';
    const imageInputs = Array.isArray(images) ? images.filter((item): item is string => typeof item === 'string') : [];

    if (!value && imageInputs.length === 0) {
      return badRequest(res, strings.community.textRequired);
    }
    if (value.length > communityConfig.maxMessageLength) {
      return badRequest(res, strings.community.tooLong(communityConfig.maxMessageLength));
    }
    if (imageInputs.length > communityConfig.maxImagesPerPost) {
      return badRequest(res, strings.community.tooManyImages(communityConfig.maxImagesPerPost));
    }
    if (findXssField({ text: value })) {
      return badRequest(res, strings.errors.suspiciousInput);
    }

    const savedImages: string[] = [];
    for (const dataUrl of imageInputs) {
      const saved = await saveImage(dataUrl, sessionUser.id);
      if (!saved.ok) return badRequest(res, saved.error);
      savedImages.push(saved.url);
    }

    const message = await postMessage({ authorId: sessionUser.id, text: value, images: savedImages });
    await notifyMentions({ text: value, actorId: sessionUser.id, canMentionEveryone });

    return created(res, { message });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}

export default withAudit(handler, { maxRequestBodyBytes: communityConfig.postMaxRequestBodyBytes });
