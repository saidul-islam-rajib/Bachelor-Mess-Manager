import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser, requireAdmin } from '@/lib/auth-utils';
import { badRequest, created, methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { communityConfig, toLetConfig } from '@/config';
import { directory, ensureWelcomeMessage, notifyMentions, postMessage, readFeed, searchListings, unreadCount } from '@/lib/community';
import { geocode } from '@/lib/geo';
import { strings } from '@/lib/i18n';
import { TOLET_TYPE_VALUES } from '@/lib/constants';
import { queryInt, queryString } from '@/lib/query';
import { parseToLetFields } from '@/lib/tolet-validation';
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
    const q = queryString(req, 'q');
    const type = queryString(req, 'type');
    const minRentRaw = queryString(req, 'minRent');
    const maxRentRaw = queryString(req, 'maxRent');
    const isSearch = Boolean(q || type || minRentRaw || maxRentRaw);

    if (isSearch) {
      const page = queryInt(req, 'page', 1, 1, Number.MAX_SAFE_INTEGER);
      const minRent = minRentRaw !== undefined && Number.isFinite(Number(minRentRaw)) ? Number(minRentRaw) : undefined;
      const maxRent = maxRentRaw !== undefined && Number.isFinite(Number(maxRentRaw)) ? Number(maxRentRaw) : undefined;

      const result = await searchListings({
        q,
        type: type && TOLET_TYPE_VALUES.includes(type) ? type : undefined,
        minRent,
        maxRent,
        page,
        pageSize: toLetConfig.searchPageSize,
        viewerId: sessionUser?.id ?? null
      });

      return ok(res, { mode: 'search', ...result });
    }

    const after = queryString(req, 'after');
    const before = queryString(req, 'before');
    const limit = queryInt(req, 'limit', communityConfig.pageSize, 1, communityConfig.pageSize);
    const canMentionEveryone = sessionUser ? requireAdmin(sessionUser) : false;

    if (sessionUser) await ensureWelcomeMessage(sessionUser);

    const feed = await readFeed({ after, before, limit, viewerId: sessionUser?.id ?? null });
    const incremental = Boolean(after);

    return ok(res, {
      mode: 'feed',
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
    const body = req.body as Record<string, unknown>;
    const { text, images, listingType } = body;
    const value = typeof text === 'string' ? text.trim() : '';
    const imageInputs = Array.isArray(images) ? images.filter((item): item is string => typeof item === 'string') : [];
    const isToLet = listingType !== undefined;

    if (isToLet) {
      if (imageInputs.length > toLetConfig.maxImagesPerListing) {
        return badRequest(res, strings.toLet.tooManyPhotos(toLetConfig.maxImagesPerListing));
      }

      const toLetCheck = parseToLetFields(body);
      if (!toLetCheck.ok) return badRequest(res, toLetCheck.error);

      if (findXssField({ title: toLetCheck.title, text: toLetCheck.text, location: toLetCheck.value.location })) {
        return badRequest(res, strings.errors.suspiciousInput);
      }

      if (toLetCheck.value.latitude === null || toLetCheck.value.longitude === null) {
        const point = await geocode(toLetCheck.value.location);
        if (point) {
          toLetCheck.value.latitude = point.lat;
          toLetCheck.value.longitude = point.lng;
        }
      }

      const savedImages: string[] = [];
      for (const dataUrl of imageInputs) {
        const saved = await saveImage(dataUrl, sessionUser.id);
        if (!saved.ok) return badRequest(res, saved.error);
        savedImages.push(saved.url);
      }

      const message = await postMessage({
        authorId: sessionUser.id,
        title: toLetCheck.title,
        text: toLetCheck.text,
        images: savedImages,
        toLet: toLetCheck.value
      });

      return created(res, { message });
    }

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
