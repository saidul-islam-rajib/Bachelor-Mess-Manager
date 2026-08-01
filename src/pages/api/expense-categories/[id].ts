import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { canManageGroup, getSessionUser } from '@/lib/auth-utils';
import { badRequest, conflict, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { containsXss } from '@/lib/xss';
import { MAX_CATEGORY_LABEL } from '@/lib/expense-categories';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id) {
    return badRequest(res, 'Category ID is required.');
  }

  const category = await prisma.expenseCategory.findUnique({ where: { id } });
  if (!category) {
    return notFound(res, 'That cost type no longer exists.');
  }
  if (!(await canManageGroup(category.groupId, sessionUser))) {
    return forbidden(res, "Only this group's supervisor can change cost types.");
  }

  if (req.method === 'PATCH') {
    const { label, sortOrder, archived } = req.body as {
      label?: unknown;
      sortOrder?: unknown;
      archived?: unknown;
    };

    const data: Record<string, unknown> = {};

    if (label !== undefined) {
      const trimmed = typeof label === 'string' ? label.trim().replace(/\s+/g, ' ') : '';
      if (!trimmed) {
        return badRequest(res, 'Give the cost type a name.');
      }
      if (trimmed.length > MAX_CATEGORY_LABEL) {
        return badRequest(res, `Keep the name under ${MAX_CATEGORY_LABEL} characters.`);
      }
      if (containsXss(trimmed)) {
        return badRequest(res, 'That name contains characters we cannot accept.');
      }
      data.label = trimmed;
    }

    if (sortOrder !== undefined) {
      const order = Number(sortOrder);
      if (!Number.isInteger(order) || order < 0 || order > 999) {
        return badRequest(res, 'Sort order must be a whole number.');
      }
      data.sortOrder = order;
    }

    if (typeof archived === 'boolean') {
      data.archivedAt = archived ? new Date() : null;
    }

    if (Object.keys(data).length === 0) {
      return badRequest(res, 'Nothing to update.');
    }

    const updated = await prisma.expenseCategory.update({ where: { id }, data });

    return ok(res, {
      category: {
        id: updated.id,
        code: updated.code,
        label: updated.label,
        isSystem: updated.isSystem,
        sortOrder: updated.sortOrder,
        archived: updated.archivedAt !== null
      }
    });
  }

  if (req.method === 'DELETE') {
    const inUse = await prisma.expenseEntry.count({
      where: { groupId: category.groupId, type: category.code }
    });

    if (inUse > 0) {
      const archived = await prisma.expenseCategory.update({
        where: { id },
        data: { archivedAt: new Date() }
      });

      return ok(res, {
        archived: true,
        inUse,
        category: {
          id: archived.id,
          code: archived.code,
          label: archived.label,
          isSystem: archived.isSystem,
          sortOrder: archived.sortOrder,
          archived: true
        }
      });
    }

    const remaining = await prisma.expenseCategory.count({
      where: { groupId: category.groupId, archivedAt: null }
    });
    if (remaining <= 1) {
      return conflict(res, 'Keep at least one cost type so bills can still be recorded.');
    }

    await prisma.expenseCategory.delete({ where: { id } });
    return ok(res, { archived: false, deleted: true });
  }

  return methodNotAllowed(res, ['PATCH', 'DELETE']);
}

export default withAudit(handler);
