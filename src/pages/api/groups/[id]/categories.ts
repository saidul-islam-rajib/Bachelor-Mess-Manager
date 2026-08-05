import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { canManageGroup, getSessionUser, isGroupMember, requireAdmin } from '@/lib/auth-utils';
import { badRequest, conflict, created, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { EXPENSE_TYPES } from '@/lib/constants';
import { containsXss } from '@/lib/xss';
import {
  countUsage,
  ensureCategories,
  listCategories,
  MAX_CATEGORIES_PER_GROUP,
  MAX_CATEGORY_LABEL,
  toCategoryCode
} from '@/lib/expense-categories';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const groupId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!groupId) {
    return badRequest(res, 'Group ID is required.');
  }

  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true } });
  if (!group) {
    return notFound(res, 'Group not found.');
  }
  if (!(await isGroupMember(groupId, sessionUser.id)) && !requireAdmin(sessionUser)) {
    return forbidden(res, 'You are not a member of this group.');
  }

  const canManage = await canManageGroup(groupId, sessionUser);

  if (req.method === 'GET') {
    const includeArchived = req.query.includeArchived === 'true' && canManage;
    const categories = await listCategories(groupId, { includeArchived });
    const usage = canManage ? await countUsage(groupId, categories.map((c) => c.code)) : {};

    return ok(res, {
      canManage,
      categories: categories.map((category) => ({ ...category, inUse: usage[category.code] ?? 0 }))
    });
  }

  if (req.method === 'POST') {
    if (!canManage) {
      return forbidden(res, "Only this group's supervisor can add cost types.");
    }

    const { label } = req.body as { label?: unknown };
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

    const code = toCategoryCode(trimmed);
    if (!code) {
      return badRequest(res, 'Use at least one letter or number in the name.');
    }
    if (code === EXPENSE_TYPES.BAZAR) {
      return badRequest(res, 'Bazar is tracked separately and cannot be added as a bill type.');
    }

    const existing = await ensureCategories(groupId);
    if (existing.filter((category) => !category.archived).length >= MAX_CATEGORIES_PER_GROUP) {
      return conflict(res, `A group can have at most ${MAX_CATEGORIES_PER_GROUP} cost types.`);
    }

    const clash = existing.find((category) => category.code === code);
    if (clash) {
      if (!clash.archived) {
        return conflict(res, `"${clash.label}" already exists.`);
      }

      const restored = await prisma.expenseCategory.update({
        where: { id: clash.id },
        data: { archivedAt: null, label: trimmed }
      });
      return ok(res, {
        category: {
          id: restored.id,
          code: restored.code,
          label: restored.label,
          isSystem: restored.isSystem,
          sortOrder: restored.sortOrder,
          archived: false,
          inUse: 0
        }
      });
    }

    const category = await prisma.expenseCategory.create({
      data: {
        groupId,
        code,
        label: trimmed,
        isSystem: false,
        sortOrder: existing.length,
        publishedAt: new Date()
      }
    });

    return created(res, {
      category: {
        id: category.id,
        code: category.code,
        label: category.label,
        isSystem: false,
        sortOrder: category.sortOrder,
        archived: false,
        inUse: 0
      }
    });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}

export default withAudit(handler);
