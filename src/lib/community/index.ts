import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { appConfig, communityConfig } from '@/config';
import { ANNOUNCEMENTS } from '@/lib/community/announcements';
import { COMMUNITY_MESSAGE_TYPES, NOTIFICATION_TYPES, USER_STATUS } from '@/lib/constants';
import { strings } from '@/lib/i18n';
import { mentionIdsIn, mentionsEveryone } from '@/lib/mentions';
import { createNotifications } from '@/lib/notifications';
import { ROUTES } from '@/lib/routes';

const WELCOME_KEY_PREFIX = 'welcome:';
const MEMBER_KEY_PREFIX = 'message:';
const UNIQUE_VIOLATION = 'P2002';

export type CommunityMessageView = {
  id: string;
  type: string;
  system: boolean;
  authorId: string | null;
  authorName: string;
  authorImage: string | null;
  title: string | null;
  text: string;
  pinned: boolean;
  createdAt: string;
};

export type CommunityMember = { id: string; name: string };

export type CommunityFeed = {
  messages: CommunityMessageView[];
  pinned: CommunityMessageView[];
  mentionNames: Record<string, string>;
  hasMore: boolean;
};

type MessageRow = Prisma.CommunityMessageGetPayload<{
  select: {
    id: true;
    type: true;
    authorId: true;
    title: true;
    text: true;
    pinned: true;
    createdAt: true;
    author: { select: { id: true; name: true; profileImage: true } };
  };
}>;

const MESSAGE_SELECT = {
  id: true,
  type: true,
  authorId: true,
  title: true,
  text: true,
  pinned: true,
  createdAt: true,
  author: { select: { id: true, name: true, profileImage: true } }
} satisfies Prisma.CommunityMessageSelect;

const VISIBLE: Prisma.CommunityMessageWhereInput = { deletedAt: null, isPublished: true };

export function isSystemMessage(type: string): boolean {
  return type !== COMMUNITY_MESSAGE_TYPES.MEMBER;
}

function serialize(row: MessageRow): CommunityMessageView {
  const system = isSystemMessage(row.type);

  return {
    id: row.id,
    type: row.type,
    system,
    authorId: row.author?.id ?? null,
    authorName: row.author?.name ?? (system ? appConfig.name : strings.community.formerMember),
    authorImage: row.author?.profileImage ?? null,
    title: row.title,
    text: row.text,
    pinned: row.pinned,
    createdAt: row.createdAt.toISOString()
  };
}

function clampLimit(limit?: number): number {
  if (!limit || !Number.isFinite(limit)) return communityConfig.pageSize;
  return Math.min(Math.max(Math.trunc(limit), 1), communityConfig.pageSize);
}

function parseCursor(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

async function mentionNamesFor(rows: CommunityMessageView[]): Promise<Record<string, string>> {
  const ids = new Set<string>();
  for (const row of rows) {
    for (const id of mentionIdsIn(row.text)) ids.add(id);
  }
  if (ids.size === 0) return {};

  const users = await prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } });
  return Object.fromEntries(users.map((user) => [user.id, user.name]));
}

export async function readFeed(options: { before?: string; after?: string; limit?: number }): Promise<CommunityFeed> {
  const take = clampLimit(options.limit);
  const before = parseCursor(options.before);
  const after = parseCursor(options.after);

  const where: Prisma.CommunityMessageWhereInput = {
    ...VISIBLE,
    ...(before ? { createdAt: { lt: before } } : {}),
    ...(after ? { createdAt: { gt: after } } : {})
  };

  const rows = await prisma.communityMessage.findMany({
    where,
    select: MESSAGE_SELECT,
    orderBy: { createdAt: after ? 'asc' : 'desc' },
    take: take + 1
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  const ordered = after ? page : [...page].reverse();
  const messages = ordered.map(serialize);

  const pinnedRows = after
    ? []
    : await prisma.communityMessage.findMany({
        where: { ...VISIBLE, pinned: true },
        select: MESSAGE_SELECT,
        orderBy: { createdAt: 'desc' },
        take
      });

  const pinned = pinnedRows.map(serialize);

  return {
    messages,
    pinned,
    mentionNames: await mentionNamesFor([...messages, ...pinned]),
    hasMore: after ? false : hasMore
  };
}

export async function postMessage(params: { authorId: string; text: string }): Promise<CommunityMessageView> {
  const row = await prisma.communityMessage.create({
    data: {
      key: `${MEMBER_KEY_PREFIX}${randomUUID()}`,
      type: COMMUNITY_MESSAGE_TYPES.MEMBER,
      authorId: params.authorId,
      text: params.text,
      publishedAt: new Date()
    },
    select: MESSAGE_SELECT
  });

  return serialize(row);
}

export async function deleteMessage(id: string): Promise<void> {
  await prisma.communityMessage.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function findMessage(id: string) {
  return prisma.communityMessage.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, authorId: true, type: true }
  });
}

export async function notifyMentions(params: { text: string; actorId: string; canMentionEveryone: boolean }) {
  try {
    const explicit = [...new Set(mentionIdsIn(params.text))].filter((id) => id !== params.actorId);
    const everyone = params.canMentionEveryone && mentionsEveryone(params.text);
    if (!everyone && explicit.length === 0) return;

    const recipients = await prisma.user.findMany({
      where: {
        status: USER_STATUS.APPROVED,
        id: everyone ? { not: params.actorId } : { in: explicit.slice(0, communityConfig.mentionRecipientCap) }
      },
      select: { id: true },
      take: everyone ? communityConfig.everyoneRecipientCap : communityConfig.mentionRecipientCap
    });
    if (recipients.length === 0) return;

    await prisma.notification.createMany({
      data: recipients.map((recipient) => ({
        userId: recipient.id,
        actorId: params.actorId,
        type: NOTIFICATION_TYPES.MENTION_COMMUNITY,
        excerpt: params.text.replace(/\s+/g, ' ').trim(),
        link: ROUTES.community
      }))
    });
  } catch {
    return;
  }
}

export async function ensureWelcomeMessage(user: { id: string; name: string }): Promise<boolean> {
  const key = `${WELCOME_KEY_PREFIX}${user.id}`;

  const existing = await prisma.communityMessage.findUnique({ where: { key }, select: { id: true } });
  if (existing) return false;

  try {
    await prisma.communityMessage.create({
      data: {
        key,
        type: COMMUNITY_MESSAGE_TYPES.WELCOME,
        title: strings.community.welcome.title,
        text: strings.community.welcome.body(user.name, appConfig.name),
        publishedAt: new Date()
      }
    });
  } catch (error) {
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) return false;
    throw error;
  }

  await createNotifications([user.id], {
    type: NOTIFICATION_TYPES.COMMUNITY_WELCOME,
    title: strings.community.welcome.selfTitle(appConfig.name),
    excerpt: strings.community.welcome.selfBody,
    link: ROUTES.community
  });

  return true;
}

export async function publishPendingAnnouncements(): Promise<number> {
  const keys = ANNOUNCEMENTS.map((announcement) => announcement.key);
  if (keys.length === 0) return 0;

  const existing = await prisma.communityMessage.findMany({
    where: { key: { in: keys } },
    select: { key: true }
  });
  const published = new Set(existing.map((row) => row.key));

  let created = 0;
  for (const announcement of ANNOUNCEMENTS) {
    if (published.has(announcement.key)) continue;

    try {
      await prisma.communityMessage.create({
        data: {
          key: announcement.key,
          type: COMMUNITY_MESSAGE_TYPES.ANNOUNCEMENT,
          title: announcement.title,
          text: announcement.body,
          pinned: true,
          publishedAt: new Date()
        }
      });
      created += 1;
    } catch (error) {
      if ((error as { code?: string }).code !== UNIQUE_VIOLATION) throw error;
    }
  }

  return created;
}

export async function unreadCount(userId: string): Promise<number> {
  const marker = await prisma.communityRead.findUnique({ where: { userId }, select: { lastReadAt: true } });

  return prisma.communityMessage.count({
    where: {
      ...VISIBLE,
      OR: [{ authorId: null }, { authorId: { not: userId } }],
      ...(marker ? { createdAt: { gt: marker.lastReadAt } } : {})
    }
  });
}

export async function markRead(userId: string): Promise<void> {
  const now = new Date();

  await prisma.communityRead.upsert({
    where: { userId },
    update: { lastReadAt: now },
    create: { userId, lastReadAt: now, publishedAt: now }
  });
}

export async function directory(): Promise<CommunityMember[]> {
  const users = await prisma.user.findMany({
    where: { status: USER_STATUS.APPROVED },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
    take: communityConfig.directorySize
  });

  return users;
}
