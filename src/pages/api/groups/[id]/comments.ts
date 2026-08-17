import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { canManageGroup, getSessionUser, isGroupMember, requireAdmin } from '@/lib/auth-utils';
import { badRequest, created, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { mentionIdsIn } from '@/lib/mentions';
import { NOTIFICATION_TYPES } from '@/lib/constants';
import { notifyMentions } from '@/lib/notifications';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { strings } from '@/lib/i18n';
import { communityConfig } from '@/config';
import { saveImage } from '@/lib/uploads';
import { withAudit } from '@/lib/with-audit';

const MAX_LENGTH = 1000;

export const config = {
  api: {
    bodyParser: { sizeLimit: '54mb' }
  }
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const groupId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!groupId) {
    return badRequest(res, 'Group ID is required.');
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, supervisorId: true }
  });
  if (!group) {
    return notFound(res, 'Group not found.');
  }

  const admin = requireAdmin(sessionUser);
  if (!(await isGroupMember(groupId, sessionUser.id)) && !admin) {
    return forbidden(res, 'You are not a member of this group.');
  }

  const isSupervisor = await canManageGroup(groupId, sessionUser);

  if (req.method === 'GET') {
    if (!hasPermission(sessionUser, PERMISSIONS.COMMENT_VIEW)) {
      return forbidden(res, strings.errors.permissionDenied);
    }

    const [rows, memberships, supervisor] = await Promise.all([
      prisma.comment.findMany({
        where: { groupId, deletedAt: null },
        include: {
          user: { select: { id: true, name: true } },
          images: { select: { url: true }, orderBy: { sortOrder: 'asc' } },
          replies: {
            where: { deletedAt: null },
            include: { user: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'asc' }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.membership.findMany({
        where: { groupId, isActive: true },
        include: { user: { select: { id: true, name: true } } }
      }),
      prisma.user.findUnique({ where: { id: group.supervisorId }, select: { id: true, name: true } })
    ]);

    const memberMap = new Map<string, { id: string; name: string }>();
    for (const m of memberships) memberMap.set(m.user.id, m.user);
    if (supervisor) memberMap.set(supervisor.id, supervisor);

    const comments = rows.map((c) => ({
      id: c.id,
      text: c.text,
      authorId: c.userId,
      authorName: c.user.name,
      images: c.images.map((image) => image.url),
      createdAt: c.createdAt.toISOString(),
      replies: c.replies.map((r) => ({
        id: r.id,
        text: r.text,
        authorId: r.userId,
        authorName: r.user.name,
        isSupervisor: r.userId === group.supervisorId,
        createdAt: r.createdAt.toISOString()
      }))
    }));

    const mentioned = new Set<string>();
    for (const c of comments) {
      for (const id of mentionIdsIn(c.text)) mentioned.add(id);
      for (const r of c.replies) {
        for (const id of mentionIdsIn(r.text)) mentioned.add(id);
      }
    }

    const mentionedUsers = mentioned.size
      ? await prisma.user.findMany({ where: { id: { in: [...mentioned] } }, select: { id: true, name: true } })
      : [];
    const mentionNames: Record<string, string> = {};
    for (const u of mentionedUsers) mentionNames[u.id] = u.name;

    return ok(res, {
      comments,
      members: [...memberMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
      mentionNames,
      isSupervisor,
      currentUserId: sessionUser.id
    });
  }

  if (req.method === 'POST') {
    if (!hasPermission(sessionUser, PERMISSIONS.COMMENT_CREATE)) {
      return forbidden(res, strings.errors.permissionDenied);
    }

    const { text, images } = req.body as { text?: string; images?: unknown };
    const value = typeof text === 'string' ? text.trim() : '';
    const imageInputs = Array.isArray(images) ? images.filter((item): item is string => typeof item === 'string') : [];

    if (!value && imageInputs.length === 0) {
      return badRequest(res, strings.comments.textRequired);
    }
    if (value.length > MAX_LENGTH) {
      return badRequest(res, strings.comments.tooLong(MAX_LENGTH));
    }
    if (imageInputs.length > communityConfig.maxImagesPerPost) {
      return badRequest(res, strings.comments.tooManyImages(communityConfig.maxImagesPerPost));
    }

    const savedImages: string[] = [];
    for (const dataUrl of imageInputs) {
      const saved = await saveImage(dataUrl, sessionUser.id);
      if (!saved.ok) return badRequest(res, saved.error);
      savedImages.push(saved.url);
    }

    const comment = await prisma.comment.create({
      data: {
        userId: sessionUser.id,
        groupId,
        text: value,
        images: savedImages.length
          ? {
              create: savedImages.map((url, index) => ({
                url,
                sortOrder: index,
                createdById: sessionUser.id,
                updatedById: sessionUser.id
              }))
            }
          : undefined
      }
    });

    await notifyMentions({
      text: value,
      actorId: sessionUser.id,
      groupId,
      type: NOTIFICATION_TYPES.MENTION_COMMENT
    });

    return created(res, {
      comment: {
        id: comment.id,
        text: comment.text,
        authorId: sessionUser.id,
        authorName: sessionUser.name,
        images: savedImages,
        createdAt: comment.createdAt.toISOString(),
        replies: []
      }
    });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}

export default withAudit(handler, { maxRequestBodyBytes: communityConfig.postMaxRequestBodyBytes });
