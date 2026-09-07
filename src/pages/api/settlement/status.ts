import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getActiveMembership, getSessionUser, requireSupervisorOrAdmin } from '@/lib/auth-utils';
import { methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { messAccessFor } from '@/lib/access-server';
import { getFinalSettlement, type FinalSettlementGroup } from '@/lib/final-settlement';
import { PAYMENT_STATUS } from '@/lib/constants';
import { withAudit } from '@/lib/with-audit';

type GroupToCheck = { group: FinalSettlementGroup; role: 'MEMBER' | 'MANAGER' };

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  if ((await messAccessFor(sessionUser)).locked) {
    return ok(res, { shouldRedirect: false, groups: [] });
  }

  const groupsToCheck: GroupToCheck[] = [];

  if (requireSupervisorOrAdmin(sessionUser)) {
    const managed = await prisma.group.findMany({
      where: { OR: [{ supervisorId: sessionUser.id }, { coSupervisors: { some: { userId: sessionUser.id } } }] }
    });
    for (const group of managed) groupsToCheck.push({ group, role: 'MANAGER' });
  } else {
    const membership = await getActiveMembership(sessionUser.id);
    if (membership) {
      const group = await prisma.group.findUnique({ where: { id: membership.groupId } });
      if (group) groupsToCheck.push({ group, role: 'MEMBER' });
    }
  }

  const results = await Promise.all(
    groupsToCheck.map(async ({ group, role }) => {
      const settlement = await getFinalSettlement(group);
      if (!settlement) return null;

      const mine = settlement.members.find((member) => member.id === sessionUser.id) ?? null;
      const alreadySubmitted =
        role === 'MEMBER' &&
        (await prisma.settlementSubmission.findUnique({
          where: { closingId_userId: { closingId: settlement.closingId, userId: sessionUser.id } },
          select: { id: true }
        })) !== null;
      const shouldRedirect =
        role === 'MANAGER'
          ? settlement.allClear && !settlement.settledAt
          : !alreadySubmitted &&
            mine !== null &&
            (mine.status === PAYMENT_STATUS.PARTIAL || mine.status === PAYMENT_STATUS.PENDING);

      return {
        groupId: settlement.groupId,
        groupName: settlement.groupName,
        monthKey: settlement.monthKey,
        role,
        due: mine?.liveDue ?? 0,
        status: mine?.status ?? null,
        allClear: settlement.allClear,
        settledAt: settlement.settledAt,
        shouldRedirect
      };
    })
  );

  const groups = results.filter((row): row is NonNullable<typeof row> => row !== null);
  const shouldRedirect = groups.some((group) => group.shouldRedirect);

  return ok(res, { shouldRedirect, groups });
}

export default withAudit(handler);
