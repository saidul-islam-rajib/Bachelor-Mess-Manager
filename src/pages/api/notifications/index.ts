import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth-utils';
import { badRequest, methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { withAudit } from '@/lib/with-audit';

const MAX_PAGE_SIZE = 50;

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  if (req.method === 'GET') {
    const unreadOnly = req.query.unread === 'true';
    const limitParam = Number(Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit);
    const take = Number.isFinite(limitParam) ? Math.min(Math.max(1, limitParam), MAX_PAGE_SIZE) : 20;

    const where = { userId: sessionUser.id, ...(unreadOnly ? { readAt: null } : {}) };

    const [rows, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          actor: { select: { id: true, name: true } },
          group: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' },
        take
      }),
      prisma.notification.count({ where: { userId: sessionUser.id, readAt: null } })
    ]);

    return ok(res, {
      unreadCount,
      notifications: rows.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        link: row.link,
        readAt: row.readAt ? row.readAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        actor: row.actor,
        group: row.group
      }))
    });
  }

  if (req.method === 'PATCH') {
    const { ids, all } = req.body as { ids?: unknown; all?: unknown };

    if (all === true) {
      const result = await prisma.notification.updateMany({
        where: { userId: sessionUser.id, readAt: null },
        data: { readAt: new Date() }
      });
      return ok(res, { updated: result.count });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return badRequest(res, 'Pass the notification ids to mark as read, or all: true.');
    }
    if (ids.some((id) => typeof id !== 'string')) {
      return badRequest(res, 'Notification ids must be strings.');
    }

    const result = await prisma.notification.updateMany({
      where: { userId: sessionUser.id, id: { in: ids as string[] }, readAt: null },
      data: { readAt: new Date() }
    });

    return ok(res, { updated: result.count });
  }

  return methodNotAllowed(res, ['GET', 'PATCH']);
}

export default withAudit(handler);
