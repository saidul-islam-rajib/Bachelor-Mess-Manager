import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth-utils';
import { setSessionCookie } from '@/lib/auth';
import { hashPassword, validatePassword, verifyPassword } from '@/lib/password';
import { badRequest, methodNotAllowed, ok, unauthorized } from '@/lib/http';
import { deleteImage, saveImage } from '@/lib/uploads';
import { validateName, validatePhone } from '@/lib/validation';
import { THEME_OPTION_VALUES } from '@/lib/constants';
import { uploadConfig } from '@/config';
import { withAudit } from '@/lib/with-audit';

export const config = {
  api: {
    bodyParser: { sizeLimit: '14mb' }
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

  const { name, phone, password, currentPassword, image, removeImage, theme } = req.body as Record<string, unknown>;

  const data: {
    name?: string;
    phone?: string | null;
    password?: string;
    tokenVersion?: { increment: number };
    profileImage?: string | null;
    theme?: string;
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

  if (theme !== undefined) {
    if (typeof theme !== 'string' || !THEME_OPTION_VALUES.includes(theme)) {
      return badRequest(res, 'Choose a valid theme.');
    }
    data.theme = theme;
  }

  if (password !== undefined && password !== '') {
    const check = validatePassword(password);
    if (!check.ok) return badRequest(res, check.error);

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

    data.tokenVersion = { increment: 1 };
  }

  let previousImage: string | null = null;
  if (removeImage === true) {
    previousImage = sessionUser.profileImage;
    data.profileImage = null;
  } else if (typeof image === 'string' && image.trim()) {
    const saved = await saveImage(image, sessionUser.id);
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
      theme: true,
      tokenVersion: true
    }
  });

  if (previousImage && previousImage !== user.profileImage) {
    await deleteImage(previousImage);
  }

  if (data.tokenVersion) {
    await setSessionCookie(res, user);
  }

  const { tokenVersion: _tokenVersion, ...safeUser } = user;
  return ok(res, { user: safeUser, passwordChanged: Boolean(data.password) });
}

export default withAudit(handler, { maxRequestBodyBytes: uploadConfig.maxRequestBodyBytes });
