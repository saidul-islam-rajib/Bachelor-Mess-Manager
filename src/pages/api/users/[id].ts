import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireAdmin } from '@/lib/auth-utils';
import { badRequest, conflict, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { USER_ROLES, USER_STATUS } from '@/lib/constants';
import { withAudit } from '@/lib/with-audit';

const EDITABLE_ROLES = [USER_ROLES.SUPERVISOR, USER_ROLES.MEMBER] as string[];
const EDITABLE_STATUSES = [USER_STATUS.PENDING, USER_STATUS.APPROVED, USER_STATUS.REJECTED] as string[];

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') {
    return methodNotAllowed(res, ['PATCH']);
  }

  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }
  if (!requireAdmin(sessionUser)) {
    return forbidden(res, 'Only admins can modify users.');
  }

  const userId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!userId) {
    return badRequest(res, 'User ID is required.');
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return notFound(res, 'User not found.');
  }

  const { name, email, phone, role, status } = req.body as {
    name?: string;
    email?: string;
    phone?: string;
    role?: string;
    status?: string;
  };

  const data: { name?: string; email?: string; phone?: string | null; role?: string; status?: string } = {};

  if (typeof name === 'string' && name.trim()) {
    data.name = name.trim();
  }
  if (typeof email === 'string' && email.trim()) {
    data.email = email.trim();
  }
  if (typeof phone === 'string') {
    data.phone = phone.trim() || null;
  }
  if (role !== undefined) {
    if (!EDITABLE_ROLES.includes(role)) {
      return badRequest(res, 'Role must be SUPERVISOR or MEMBER.');
    }
    if (target.role === USER_ROLES.ADMIN) {
      return forbidden(res, 'The built-in admin account cannot be changed.');
    }
    data.role = role;
  }
  if (status !== undefined) {
    if (!EDITABLE_STATUSES.includes(status)) {
      return badRequest(res, 'Invalid status.');
    }
    if (target.role === USER_ROLES.ADMIN) {
      return forbidden(res, 'The built-in admin account cannot be changed.');
    }
    data.status = status;
  }

  if (Object.keys(data).length === 0) {
    return badRequest(res, 'Nothing to update.');
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true, role: true, status: true, phone: true }
    });
    return ok(res, { user });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return conflict(res, 'That email is already in use.');
    }
    throw error;
  }
}

export default withAudit(handler);
