import { prisma } from '@/lib/prisma';
import { appConfig } from '@/config';
import { isMailConfigured, sendMail, type MailMessage } from '@/lib/mailer';
import { escapeHtml } from '@/lib/xss';

export type NotificationInput = {
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  groupId?: string | null;
  actorId?: string | null;
};

export type NotificationRecipient = { id: string; name: string; email: string };

const MAX_BODY_LENGTH = 900;

function trimBody(body?: string | null): string | null {
  if (!body) return null;
  const clean = body.trim();
  if (!clean) return null;
  return clean.length > MAX_BODY_LENGTH ? `${clean.slice(0, MAX_BODY_LENGTH - 1)}…` : clean;
}

export function notificationEmail(recipientName: string, input: NotificationInput, url: string | null): MailMessage {
  const body = trimBody(input.body);

  const text = [
    `Hello ${recipientName},`,
    '',
    input.title,
    ...(body ? ['', body] : []),
    ...(url ? ['', url] : []),
    '',
    appConfig.name
  ].join('\n');

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f8fafc;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px">
    <h1 style="margin:0 0 8px;font-size:18px">${escapeHtml(appConfig.name)}</h1>
    <p style="margin:0 0 16px;color:#0f172a;font-size:15px;font-weight:600">${escapeHtml(input.title)}</p>
    ${body ? `<p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.6">${escapeHtml(body)}</p>` : ''}
    ${
      url
        ? `<a href="${escapeHtml(url)}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:10px 22px;border-radius:999px;font-size:14px">Open ${escapeHtml(appConfig.name)}</a>`
        : ''
    }
    <p style="margin:24px 0 0;color:#94a3b8;font-size:12px">You are receiving this because you are a member of a mess on ${escapeHtml(appConfig.name)}.</p>
  </div>
</body></html>`;

  return { to: '', subject: input.title, text, html };
}

function absoluteUrl(link?: string | null): string | null {
  if (!link) return null;
  if (/^https?:\/\//i.test(link)) return link;
  const base = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  return base ? `${base}${link.startsWith('/') ? link : `/${link}`}` : null;
}

export async function createNotifications(recipientIds: string[], input: NotificationInput): Promise<number> {
  const targets = [...new Set(recipientIds.filter(Boolean))];
  if (targets.length === 0) return 0;

  const now = new Date();
  const result = await prisma.notification.createMany({
    data: targets.map((userId) => ({
      userId,
      actorId: input.actorId ?? null,
      groupId: input.groupId ?? null,
      type: input.type,
      title: input.title,
      body: trimBody(input.body),
      link: input.link ?? null,
      publishedAt: now
    }))
  });

  return result.count;
}

export function deliverEmails(recipients: NotificationRecipient[], input: NotificationInput): void {
  if (!isMailConfigured() || recipients.length === 0) return;

  const url = absoluteUrl(input.link);

  void Promise.allSettled(
    recipients.map((recipient) => sendMail({ ...notificationEmail(recipient.name, input, url), to: recipient.email }))
  );
}

export async function notifyUsers(
  recipients: NotificationRecipient[],
  input: NotificationInput,
  options: { email?: boolean } = {}
): Promise<number> {
  const count = await createNotifications(
    recipients.map((r) => r.id),
    input
  );
  if (options.email !== false) deliverEmails(recipients, input);
  return count;
}

export async function groupAudience(
  groupId: string,
  options: { excludeUserId?: string } = {}
): Promise<NotificationRecipient[]> {
  const memberships = await prisma.membership.findMany({
    where: { groupId, isActive: true },
    select: { user: { select: { id: true, name: true, email: true } } }
  });

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { supervisor: { select: { id: true, name: true, email: true } } }
  });

  const byId = new Map<string, NotificationRecipient>();
  for (const membership of memberships) byId.set(membership.user.id, membership.user);
  if (group?.supervisor) byId.set(group.supervisor.id, group.supervisor);
  if (options.excludeUserId) byId.delete(options.excludeUserId);

  return [...byId.values()];
}

export async function notifyGroup(
  groupId: string,
  input: NotificationInput,
  options: { excludeUserId?: string; email?: boolean } = {}
): Promise<number> {
  const recipients = await groupAudience(groupId, { excludeUserId: options.excludeUserId });
  return notifyUsers(recipients, { ...input, groupId }, { email: options.email });
}
