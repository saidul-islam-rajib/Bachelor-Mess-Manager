import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { requireAdmin, getSessionUser } from '@/lib/auth-utils';
import { methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { settlementConfig } from '@/config';
import { GROUP_STATUS } from '@/lib/constants';
import { ensureFinalSettlement } from '@/lib/final-settlement';
import { withAudit } from '@/lib/with-audit';

const DISPATCH_SECRET_HEADER = 'x-dispatch-secret';

function secretMatches(req: NextApiRequest): boolean {
  const secret = settlementConfig.dispatchSecret;
  if (!secret) return false;

  const header = req.headers[DISPATCH_SECRET_HEADER];
  const value = Array.isArray(header) ? header[0] : header;
  return typeof value === 'string' && value === secret;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  if (!secretMatches(req)) {
    const sessionUser = await getSessionUser(req, res);
    if (!sessionUser || !requireAdmin(sessionUser)) {
      return unauthorized(res, 'You must be signed in as an admin, or provide the dispatch secret.');
    }
  }

  const groups = await prisma.group.findMany({ where: { status: GROUP_STATUS.ACTIVE } });

  let finalized = 0;
  for (const group of groups) {
    const closing = await ensureFinalSettlement(group);
    if (closing) finalized += 1;
  }

  return ok(res, { checked: groups.length, finalized });
}

export default withAudit(handler);
