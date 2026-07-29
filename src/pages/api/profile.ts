import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth-utils';
import { setSessionCookie } from '@/lib/auth';
import { hashPassword, validatePassword, verifyPassword } from '@/lib/password';
import { badRequest, methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { deleteProfileImage, saveProfileImage } from '@/lib/uploads';
import { validateName, validatePhone } from '@/lib/validation';
import { withAudit } from '@/lib/with-audit';

export const config = {
  api: {
    // Profile images travel as base64 in the JSON body; 2 MB of image is ~2.7 MB
    // encoded, so allow headroom above the 1 MB Next.js default.
    bodyParser: { sizeLimit: '4mb' }
  }
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') {
    return methodNotAllowed(res, ['PATCH']);
  }

  const sessionUser = await getSessionUser(req, res);
  if (!sessionUser) {
    return unauthorized(res, 'You must be signed in.');
  }

  const { name, phone, password, currentPassword, image, removeImage } = req.body as Record<string, unknown>;

  const data: {
    name?: string;
    phone?: string | null;
    password?: string;
    tokenVersion?: { increment: number };
    profileImage?: string | null;
  } = {};

  if (name !== undefined) {
    const check = validateName(name);
    if (!check.ok) return badRequest(res, check.error);
    data.name = check.value;
  }

  if (phone !== undefined) {
    const check = validatePhone(phone);
    if (!check.ok) return badRequest(res, check.error);
    data.phone = check.value;
  }

  if (password !== undefined && password !== '') {
    const check = validatePassword(password);
    if (!check.ok) return badRequest(res, check.error);

    // Changing a password requires proving you know the current one. Without
    // this, anyone who walks up to an unlocked browser owns the account.
    if (typeof currentPassword !== 'string' || !currentPassword) {
      return badRequest(res, 'Enter your current password to set a new one.');
    }

    const account = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { password: true }
    });
    if (!account || !(await verifyPassword(currentPassword, account.password))) {
      return badRequest(res, 'Your current password is not correct.');
    }

    data.password = await hashPassword(password as string);
    // Invalidate every other session that was signed in with the old password.
    data.tokenVersion = { increment: 1 };
  }

  // Image: either a new data URL, or an explicit removal.
  let previousImage: string | null = null;
  if (removeImage === true) {
    previousImage = sessionUser.profileImage;
    data.profileImage = null;
  } else if (typeof image === 'string' && image.trim()) {
    const saved = await saveProfileImage(image, sessionUser.id);
    if (!saved.ok) return badRequest(res, saved.error);
    previousImage = sessionUser.profileImage;
    data.profileImage = saved.url;
  }

  if (Object.keys(data).length === 0) {
    return badRequest(res, 'Nothing to update.');
  }

  const user = await prisma.user.update({
    where: { id: sessionUser.id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      profileImage: true,
      tokenVersion: true
    }
  });

  // Only after the row is safely updated do we drop the old file.
  if (previousImage && previousImage !== user.profileImage) {
    await deleteProfileImage(previousImage);
  }

  // A password change bumped tokenVersion, which would log this browser out too.
  // Re-issue the cookie so the person who made the change stays signed in.
  if (data.tokenVersion) {
    await setSessionCookie(res, user.id, user.tokenVersion);
  }

  const { tokenVersion: _tokenVersion, ...safeUser } = user;
  return ok(res, { user: safeUser, passwordChanged: Boolean(data.password) });
}

export default withAudit(handler);
