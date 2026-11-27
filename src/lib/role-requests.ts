import { prisma } from '@/lib/prisma';
import { USER_ROLES } from '@/lib/constants';
import { getSiteSettings } from '@/lib/settings-service';
import { traced } from '@/lib/log';

export const ROLE_REQUEST_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED'
} as const;

export const ROLE_REQUEST_STATUS_VALUES = Object.values(ROLE_REQUEST_STATUS) as string[];

export const REQUESTABLE_ROLES = [USER_ROLES.SUPERVISOR, USER_ROLES.MEMBER] as string[];

export type RoleRequestOutcome =
  | { ok: true; autoApproved: boolean; requestId: string }
  | { ok: false; error: string };

export async function getRolePolicy() {
  const settings = await getSiteSettings();
  return {
    autoApproveSupervisor: settings.autoApproveSupervisor,
    allowSelfRoleSwitch: settings.allowSelfRoleSwitch
  };
}

async function applyRoleImpl(userId: string, role: string, decidedById: string | null) {
  await prisma.user.update({
    where: { id: userId },
    data: { role, tokenVersion: { increment: 1 } }
  });

  if (decidedById) return;
}

async function createRoleRequestImpl(params: {
  userId: string;
  requestedRole: string;
  reason?: string | null;
}): Promise<RoleRequestOutcome> {
  const { userId, requestedRole } = params;

  if (!REQUESTABLE_ROLES.includes(requestedRole)) {
    return { ok: false, error: 'You can only request the supervisor or member role.' };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true }
  });
  if (!user) return { ok: false, error: 'Account not found.' };

  if (user.role === USER_ROLES.ADMIN) {
    return { ok: false, error: 'Administrators already have every permission.' };
  }
  if (user.role === requestedRole) {
    return { ok: false, error: `You are already a ${requestedRole.toLowerCase()}.` };
  }

  const pending = await prisma.roleRequest.findFirst({
    where: { userId, status: ROLE_REQUEST_STATUS.PENDING },
    select: { id: true }
  });
  if (pending) {
    return { ok: false, error: 'You already have a request waiting for a decision.' };
  }

  const policy = await getRolePolicy();

  const stepDown = requestedRole === USER_ROLES.MEMBER;
  const autoApprove = stepDown
    ? policy.allowSelfRoleSwitch
    : policy.autoApproveSupervisor;

  if (stepDown && !policy.allowSelfRoleSwitch) {
    return { ok: false, error: 'Switching your own role is disabled. Ask an administrator.' };
  }

  if (stepDown) {
    const supervised = await prisma.group.count({ where: { supervisorId: userId } });
    if (supervised > 0) {
      return {
        ok: false,
        error: `You still supervise ${supervised} group${supervised === 1 ? '' : 's'}. Hand them over before becoming a member.`
      };
    }
  }

  const request = await prisma.roleRequest.create({
    data: {
      userId,
      requestedRole,
      reason: params.reason?.trim() || null,
      status: autoApprove ? ROLE_REQUEST_STATUS.APPROVED : ROLE_REQUEST_STATUS.PENDING,
      decidedAt: autoApprove ? new Date() : null,
      decisionNote: autoApprove ? 'Automatically approved by policy.' : null,
      publishedAt: new Date()
    }
  });

  if (autoApprove) {
    await applyRole(userId, requestedRole, null);
  }

  return { ok: true, autoApproved: autoApprove, requestId: request.id };
}

async function decideRoleRequestImpl(params: {
  requestId: string;
  approve: boolean;
  decidedById: string;
  note?: string | null;
}): Promise<{ ok: true; userId: string; role: string } | { ok: false; error: string }> {
  const request = await prisma.roleRequest.findUnique({
    where: { id: params.requestId },
    select: { id: true, userId: true, requestedRole: true, status: true }
  });

  if (!request) return { ok: false, error: 'Request not found.' };
  if (request.status !== ROLE_REQUEST_STATUS.PENDING) {
    return { ok: false, error: 'That request has already been decided.' };
  }

  await prisma.roleRequest.update({
    where: { id: request.id },
    data: {
      status: params.approve ? ROLE_REQUEST_STATUS.APPROVED : ROLE_REQUEST_STATUS.REJECTED,
      decidedById: params.decidedById,
      decidedAt: new Date(),
      decisionNote: params.note?.trim() || null
    }
  });

  if (params.approve) {
    await applyRole(request.userId, request.requestedRole, params.decidedById);
  }

  return { ok: true, userId: request.userId, role: request.requestedRole };
}

export const applyRole = traced('applyRole', applyRoleImpl);

export const createRoleRequest = traced('createRoleRequest', createRoleRequestImpl);

export const decideRoleRequest = traced('decideRoleRequest', decideRoleRequestImpl);
