import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireAdmin } from '@/lib/auth-utils';
import { forbidden, methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { withAudit } from '@/lib/with-audit';

const SETTINGS_ID = 'singleton';

async function getSettings() {
  return prisma.siteSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID }
  });
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  
  if (req.method === 'GET') {
    return ok(res, { settings: await getSettings() });
  }

  if (req.method === 'PATCH') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) {
      return unauthorized(res, 'You must be signed in.');
    }
    if (!requireAdmin(sessionUser)) {
      return forbidden(res, 'Only admins can change site settings.');
    }

    const body = req.body as Record<string, unknown>;
    const stringFields = [
      'companyName',
      'tagline',
      'address',
      'contactEmail',
      'contactPhone',
      'copyrightOwner',
      'facebookUrl',
      'twitterUrl'
    ] as const;

    const data: Record<string, unknown> = {};
    for (const field of stringFields) {
      if (typeof body[field] === 'string') {
        const value = (body[field] as string).trim();
        data[field] = value || null;
      }
    }
    
    if (typeof body.companyName === 'string' && !(body.companyName as string).trim()) {
      delete data.companyName;
    }
    if (typeof body.copyrightOwner === 'string' && !(body.copyrightOwner as string).trim()) {
      delete data.copyrightOwner;
    }
    if (typeof body.newsletterEnabled === 'boolean') {
      data.newsletterEnabled = body.newsletterEnabled;
    }
    if (typeof body.autoApproveSupervisor === 'boolean') {
      data.autoApproveSupervisor = body.autoApproveSupervisor;
    }
    if (typeof body.allowSelfRoleSwitch === 'boolean') {
      data.allowSelfRoleSwitch = body.allowSelfRoleSwitch;
    }

    const settings = await prisma.siteSettings.upsert({
      where: { id: SETTINGS_ID },
      update: data,
      create: { id: SETTINGS_ID, ...data }
    });

    return ok(res, { settings });
  }

  return methodNotAllowed(res, ['GET', 'PATCH']);
}

export default withAudit(handler);
