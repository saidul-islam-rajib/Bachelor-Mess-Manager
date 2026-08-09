import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireAdmin } from '@/lib/auth-utils';
import { badRequest, forbidden, methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { invalidateSecurityPolicyCache, uploadPolicyFallback } from '@/lib/settings-service';
import { cached, invalidate } from '@/lib/cache';
import { cacheConfig } from '@/config';
import { formatBytes } from '@/lib/format';
import { strings } from '@/lib/i18n';
import { withAudit } from '@/lib/with-audit';

const SETTINGS_ID = 'singleton';
const SETTINGS_CACHE_KEY = 'site-settings';

const PUBLIC_FIELDS = [
  'companyName',
  'tagline',
  'address',
  'contactEmail',
  'contactPhone',
  'copyrightOwner',
  'facebookUrl',
  'twitterUrl',
  'newsletterEnabled',
  'maxProfileImageBytes'
] as const;

async function getSettings() {
  return cached(SETTINGS_CACHE_KEY, cacheConfig.siteSettingsMs, () =>
    prisma.siteSettings.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: { id: SETTINGS_ID }
    })
  );
}

function publicView(settings: Awaited<ReturnType<typeof getSettings>>) {
  return Object.fromEntries(PUBLIC_FIELDS.map((field) => [field, settings[field]]));
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const settings = await getSettings();
    const sessionUser = await getSessionUser(req);

    if (sessionUser && requireAdmin(sessionUser)) {
      return ok(res, { settings });
    }

    return ok(res, { settings: publicView(settings) });
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
    if (typeof body.autoApproveRegistration === 'boolean') {
      data.autoApproveRegistration = body.autoApproveRegistration;
    }
    if (typeof body.allowSelfRoleSwitch === 'boolean') {
      data.allowSelfRoleSwitch = body.allowSelfRoleSwitch;
    }
    if (typeof body.mealEditRequiresApproval === 'boolean') {
      data.mealEditRequiresApproval = body.mealEditRequiresApproval;
    }
    if (body.mealEditWindowMinutes !== undefined) {
      const minutes = Number(body.mealEditWindowMinutes);
      if (!Number.isInteger(minutes) || minutes < 0 || minutes > 10080) {
        return badRequest(res, 'The meal edit window must be between 0 minutes (no limit) and 7 days.');
      }
      data.mealEditWindowMinutes = minutes;
    }
    if (body.maxProfileImageBytes !== undefined) {
      const bytes = Number(body.maxProfileImageBytes);
      const { minConfigurableBytes, maxConfigurableBytes } = uploadPolicyFallback();

      if (!Number.isInteger(bytes) || bytes < minConfigurableBytes || bytes > maxConfigurableBytes) {
        return badRequest(
          res,
          strings.admin.settings.maxProfileImageInvalid(
            formatBytes(minConfigurableBytes),
            formatBytes(maxConfigurableBytes)
          )
        );
      }
      data.maxProfileImageBytes = bytes;
    }

    const settings = await prisma.siteSettings.upsert({
      where: { id: SETTINGS_ID },
      update: data,
      create: { id: SETTINGS_ID, ...data }
    });

    invalidateSecurityPolicyCache();
    invalidate(SETTINGS_CACHE_KEY);

    return ok(res, { settings });
  }

  return methodNotAllowed(res, ['GET', 'PATCH']);
}

export default withAudit(handler);
