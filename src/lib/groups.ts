// Group membership rules.
//
// Two constraints from the spec live here so that every route that can create a
// membership enforces them identically:
//
//   1. A member is active in at most one group at a time. Moving mess means
//      leaving the old one first; the history (`leftAt`) is kept either way.
//   2. A supervisor runs at most 10 groups.
//
// Supervisors are exempt from rule 1: they hold a membership in each group they
// run so that their own meals are counted in that group's totals.

import { prisma } from '@/lib/prisma';
import { USER_ROLES } from '@/lib/constants';

export const MAX_GROUPS_PER_SUPERVISOR = 10;

export type JoinCheck = { ok: true } | { ok: false; error: string };

/**
 * Can this user become an active member of `groupId` right now?
 *
 * Returns a ready-to-send message on failure so callers stay one-liners.
 */
export async function canJoinGroup(userId: string, groupId: string): Promise<JoinCheck> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true }
  });
  if (!user) return { ok: false, error: 'That user no longer exists.' };

  // A supervisor is a member of each mess they run — the one-group rule is for members.
  if (user.role === USER_ROLES.SUPERVISOR || user.role === USER_ROLES.ADMIN) {
    return { ok: true };
  }

  const active = await prisma.membership.findFirst({
    where: { userId, isActive: true, groupId: { not: groupId } },
    include: { group: { select: { name: true } } }
  });

  if (active) {
    return {
      ok: false,
      error: `Already an active member of "${active.group.name}". A member can only be in one group at a time — leave that group first.`
    };
  }

  return { ok: true };
}

/** Same check, phrased for the person doing the joining. */
export async function canJoinGroupSelf(userId: string, groupId: string): Promise<JoinCheck> {
  const check = await canJoinGroup(userId, groupId);
  if (check.ok) return check;

  const active = await prisma.membership.findFirst({
    where: { userId, isActive: true, groupId: { not: groupId } },
    include: { group: { select: { name: true } } }
  });

  return {
    ok: false,
    error: active
      ? `You are already in "${active.group.name}". You can only be in one group at a time — leave it first, then accept this invitation.`
      : check.error
  };
}

/** Enforces the 10-group ceiling. Admins are not capped; they act on behalf of others. */
export async function canCreateGroup(supervisorId: string): Promise<JoinCheck> {
  const count = await prisma.group.count({ where: { supervisorId } });
  if (count >= MAX_GROUPS_PER_SUPERVISOR) {
    return {
      ok: false,
      error: `A supervisor can manage at most ${MAX_GROUPS_PER_SUPERVISOR} groups. This supervisor already has ${count}.`
    };
  }
  return { ok: true };
}

/**
 * Activate a membership, creating it if this user has never been in the group.
 * Re-joining reuses the original row so `joinedAt` still reflects the first stay.
 */
export async function activateMembership(groupId: string, userId: string) {
  const existing = await prisma.membership.findFirst({ where: { groupId, userId } });

  if (!existing) {
    return prisma.membership.create({ data: { groupId, userId, isActive: true } });
  }
  if (existing.isActive) return existing;

  return prisma.membership.update({
    where: { id: existing.id },
    // A new stay starts now; leftAt is cleared so the member reads as current.
    data: { isActive: true, leftAt: null, joinedAt: new Date() }
  });
}

/** How many whole days this membership has lasted (or lasted for, if ended). */
export function stayDays(joinedAt: Date, leftAt: Date | null): number {
  const end = leftAt ?? new Date();
  return Math.max(0, Math.floor((end.getTime() - joinedAt.getTime()) / 86_400_000));
}
