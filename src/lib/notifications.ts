import { prisma } from '@/lib/prisma';
import { appConfig } from '@/config';
import { flattenMentions, mentionIdsIn, mentionsEveryone } from '@/lib/mentions';
import { isMailConfigured, sendMail, type MailMessage } from '@/lib/mailer';
import { commentsAnchorPath, ROUTES } from '@/lib/routes';
import { buildPageMeta, type PageMeta } from '@/lib/query';
import { NOTIFICATION_TYPES, type NotificationType } from '@/lib/constants';
import { isNotificationEnabled } from '@/lib/settings-service';
import { escapeHtml } from '@/lib/xss';

const MAX_RECIPIENTS = 10;
const EXCERPT_LENGTH = 160;
const FEED_SIZE = 20;

export type NotificationFeedItem = {
  id: string;
  type: string;
  actorId: string | null;
  actorName: string;
  groupId: string | null;
  groupName: string | null;
  title: string | null;
  excerpt: string;
  link: string;
  read: boolean;
  createdAt: string;
};

export type NotificationInput = {
  type: string;
  title: string;
  excerpt?: string | null;
  link: string;
  groupId?: string | null;
  actorId?: string | null;
};

export type NotificationRecipient = { id: string; name: string; email: string };

function truncate(text: string) {
  return text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH - 1)}…` : text;
}

export function mentionLink(type: NotificationType, groupId: string) {
  if (type === NOTIFICATION_TYPES.MENTION_EXPENSE_COMMENT) {
    return `${ROUTES.expenses}?group=${groupId}`;
  }
  return commentsAnchorPath(groupId);
}

async function eligibleRecipients(groupId: string, userIds: string[]) {
  const [group, memberships] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId }, select: { supervisorId: true } }),
    prisma.membership.findMany({
      where: { groupId, isActive: true, userId: { in: userIds } },
      select: { userId: true }
    })
  ]);

  const allowed = new Set(memberships.map((membership) => membership.userId));
  if (group && userIds.includes(group.supervisorId)) allowed.add(group.supervisorId);

  return userIds.filter((id) => allowed.has(id));
}

export async function notifyMentions({
  text,
  actorId,
  groupId,
  type
}: {
  text: string;
  actorId: string;
  groupId: string;
  type: NotificationType;
}) {
  try {
    const everyone = mentionsEveryone(text);
    const mentioned = [...new Set(mentionIdsIn(text))].filter((id) => id !== actorId).slice(0, MAX_RECIPIENTS);
    if (!everyone && mentioned.length === 0) return;

    const recipients = everyone
      ? (await groupAudience(groupId, { excludeUserId: actorId })).map((recipient) => recipient.id)
      : await eligibleRecipients(groupId, mentioned);
    if (recipients.length === 0) return;
    if (!(await isNotificationEnabled(type))) return;

    await prisma.notification.createMany({
      data: recipients.map((userId) => ({
        userId,
        actorId,
        groupId,
        type,
        excerpt: text.replace(/\s+/g, ' ').trim(),
        link: mentionLink(type, groupId)
      }))
    });
  } catch {
    return;
  }
}

export async function notificationFeed(
  userId: string,
  options: { page?: number; pageSize?: number; unreadOnly?: boolean } = {}
): Promise<{
  notifications: NotificationFeedItem[];
  unreadCount: number;
  meta: PageMeta;
}> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.max(1, options.pageSize ?? FEED_SIZE);
  const where = options.unreadOnly ? { userId, readAt: null } : { userId };

  const [rows, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      include: {
        actor: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, readAt: null } })
  ]);

  const mentioned = new Set<string>();
  for (const row of rows) {
    for (const id of mentionIdsIn(row.excerpt ?? '')) mentioned.add(id);
  }

  const mentionedUsers = mentioned.size
    ? await prisma.user.findMany({ where: { id: { in: [...mentioned] } }, select: { id: true, name: true } })
    : [];
  const names: Record<string, string> = {};
  for (const user of mentionedUsers) names[user.id] = user.name;

  return {
    notifications: rows.map((row) => ({
      id: row.id,
      type: row.type,
      actorId: row.actor?.id ?? null,
      actorName: row.actor?.name ?? 'Someone',
      groupId: row.group?.id ?? null,
      groupName: row.group?.name ?? null,
      title: row.title,
      excerpt: truncate(flattenMentions(row.excerpt ?? '', names)),
      link: row.link,
      read: row.readAt !== null,
      createdAt: row.createdAt.toISOString()
    })),
    unreadCount,
    meta: buildPageMeta(page, pageSize, total)
  };
}

function trimExcerpt(text?: string | null): string | null {
  if (!text) return null;
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  return clean.length > 900 ? `${clean.slice(0, 899)}…` : clean;
}

export function notificationEmail(recipientName: string, input: NotificationInput, url: string | null): MailMessage {
  const excerpt = trimExcerpt(input.excerpt);

  const text = [
    `Hello ${recipientName},`,
    '',
    input.title,
    ...(excerpt ? ['', excerpt] : []),
    ...(url ? ['', url] : []),
    '',
    appConfig.name
  ].join('\n');

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f8fafc;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px">
    <h1 style="margin:0 0 8px;font-size:18px">${escapeHtml(appConfig.name)}</h1>
    <p style="margin:0 0 16px;color:#0f172a;font-size:15px;font-weight:600">${escapeHtml(input.title)}</p>
    ${excerpt ? `<p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.6">${escapeHtml(excerpt)}</p>` : ''}
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

function absoluteUrl(link: string): string | null {
  if (/^https?:\/\//i.test(link)) return link;
  const base = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  return base ? `${base}${link.startsWith('/') ? link : `/${link}`}` : null;
}

export async function createNotifications(recipientIds: string[], input: NotificationInput): Promise<number> {
  const targets = [...new Set(recipientIds.filter(Boolean))];
  if (targets.length === 0) return 0;
  if (!(await isNotificationEnabled(input.type))) return 0;

  const now = new Date();
  const result = await prisma.notification.createMany({
    data: targets.map((userId) => ({
      userId,
      actorId: input.actorId ?? null,
      groupId: input.groupId ?? null,
      type: input.type,
      title: input.title,
      excerpt: trimExcerpt(input.excerpt),
      link: input.link,
      publishedAt: now
    }))
  });

  return result.count;
}

export function deliverEmails(recipients: NotificationRecipient[], input: NotificationInput): void {
  if (!isMailConfigured() || recipients.length === 0) return;

  const url = absoluteUrl(input.link);

  void (async () => {
    if (!(await isNotificationEnabled(input.type))) return;
    await Promise.allSettled(
      recipients.map((recipient) => sendMail({ ...notificationEmail(recipient.name, input, url), to: recipient.email }))
    );
  })();
}

export async function notifyUsers(
  recipients: NotificationRecipient[],
  input: NotificationInput,
  options: { email?: boolean } = {}
): Promise<number> {
  const count = await createNotifications(
    recipients.map((recipient) => recipient.id),
    input
  );
  if (options.email !== false) deliverEmails(recipients, input);
  return count;
}

export async function groupAudience(
  groupId: string,
  options: { excludeUserId?: string } = {}
): Promise<NotificationRecipient[]> {
  const [memberships, group] = await Promise.all([
    prisma.membership.findMany({
      where: { groupId, isActive: true },
      select: { user: { select: { id: true, name: true, email: true } } }
    }),
    prisma.group.findUnique({
      where: { id: groupId },
      select: { supervisor: { select: { id: true, name: true, email: true } } }
    })
  ]);

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
