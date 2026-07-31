import { prisma } from '@/lib/prisma';
import { flattenMentions, mentionIdsIn } from '@/lib/mentions';
import { ROUTES } from '@/lib/routes';
import { NOTIFICATION_TYPES, type NotificationType } from '@/lib/constants';

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
  excerpt: string;
  link: string;
  read: boolean;
  createdAt: string;
};

function truncate(text: string) {
  return text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH - 1)}…` : text;
}

export function mentionLink(type: NotificationType, groupId: string) {
  const page = type === NOTIFICATION_TYPES.MENTION_EXPENSE_COMMENT ? ROUTES.expenses : ROUTES.comments;
  return `${page}?group=${groupId}`;
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
    const mentioned = [...new Set(mentionIdsIn(text))].filter((id) => id !== actorId).slice(0, MAX_RECIPIENTS);
    if (mentioned.length === 0) return;

    const recipients = await eligibleRecipients(groupId, mentioned);
    if (recipients.length === 0) return;

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

export async function notificationFeed(userId: string): Promise<{
  notifications: NotificationFeedItem[];
  unreadCount: number;
}> {
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      include: {
        actor: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: FEED_SIZE
    }),
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
      excerpt: truncate(flattenMentions(row.excerpt ?? '', names)),
      link: row.link,
      read: row.readAt !== null,
      createdAt: row.createdAt.toISOString()
    })),
    unreadCount
  };
}
