import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireAdmin } from '@/lib/auth-utils';
import { badRequest, conflict, forbidden, methodNotAllowed, notFound, ok, unauthorized } from '@/lib/http';
import { USER_ROLE_VALUES, USER_STATUS_VALUES } from '@/lib/constants';
import { hashPassword, validatePasswordWithPolicy } from '@/lib/password';
import { getSecurityPolicy } from '@/lib/settings-service';
import { validateEmail, validateName, validatePhone } from '@/lib/validation';
import { strings } from '@/lib/i18n';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') {
    return methodNotAllowed(res, ['PATCH']);
  }

  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return unauthorized(res, strings.errors.unauthorized);
  }
  if (!requireAdmin(sessionUser)) {
    return forbidden(res, strings.errors.adminOnly);
  }

  const userId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!userId) {
    return badRequest(res, strings.admin.users.idRequired);
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return notFound(res, strings.admin.users.notFound);
  }

  const { name, email, phone, role, status, password } = req.body as {
    name?: string;
    email?: string;
    phone?: string;
    role?: string;
    status?: string;
    password?: string;
  };

  const data: {
    name?: string;
    email?: string;
    phone?: string | null;
    role?: string;
    status?: string;
    password?: string;
    tokenVersion?: { increment: number };
  } = {};

  if (name !== undefined) {
    const check = validateName(name);
    if (!check.ok) return badRequest(res, check.error);
    data.name = check.value;
  }
  if (email !== undefined) {
    const check = validateEmail(email);
    if (!check.ok) return badRequest(res, check.error);
    data.email = check.value;
  }
  if (phone !== undefined) {
    const check = validatePhone(phone);
    if (!check.ok) return badRequest(res, check.error);
    data.phone = check.value;
  }
  if (role !== undefined) {
    if (!USER_ROLE_VALUES.includes(role)) {
      return badRequest(res, strings.admin.users.invalidRole);
    }
    data.role = role;
  }
  if (status !== undefined) {
    if (!USER_STATUS_VALUES.includes(status)) {
      return badRequest(res, strings.admin.users.invalidStatus);
    }
    data.status = status;
  }

  const roleChanged = data.role !== undefined && data.role !== target.role;
  const statusChanged = data.status !== undefined && data.status !== target.status;

  if ((roleChanged || statusChanged) && target.id === sessionUser.id) {
    return forbidden(res, strings.admin.users.cannotChangeSelf);
  }

  let passwordChanged = false;
  if (password !== undefined && password !== '') {
    const policy = await getSecurityPolicy();
    const check = validatePasswordWithPolicy(password, policy.requireStrongPasswords);
    if (!check.ok) return badRequest(res, check.error);
    data.password = await hashPassword(password);
    passwordChanged = true;
  }

  if (Object.keys(data).length === 0) {
    return badRequest(res, strings.errors.nothingToUpdate);
  }

  if (roleChanged || statusChanged || passwordChanged) {
    data.tokenVersion = { increment: 1 };
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true, role: true, status: true, phone: true }
    });

    if (passwordChanged) {
      await prisma.passwordToken.deleteMany({ where: { userId } });
    }

    return ok(res, { user });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return conflict(res, strings.errors.emailInUse);
    }
    throw error;
  }
}

export default withAudit(handler);
