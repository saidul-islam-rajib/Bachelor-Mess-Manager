import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { appConfig, communityConfig } from '@/config';
import { ANNOUNCEMENTS } from '@/lib/community/announcements';
import {
  COMMUNITY_MESSAGE_TYPES,
  NOTIFICATION_TYPES,
  TOLET_STATUS,
  USER_ROLES,
  USER_STATUS
} from '@/lib/constants';
import { strings } from '@/lib/i18n';
import { mentionIdsIn, mentionsEveryone } from '@/lib/mentions';
import { createNotifications } from '@/lib/notifications';
import { ROUTES, toLetListingPath } from '@/lib/routes';
import { isNotificationEnabled } from '@/lib/settings-service';

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
  images: string[];
  pinned: boolean;
  listingType: string | null;
  rent: number | null;
  rentNegotiable: boolean;
  location: string | null;
  genderPreference: string | null;
  contactName: string | null;
  contactPhone: string | null;
  listingStatus: string | null;
  effectiveListingStatus: string | null;
  expiresAt: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  likedByViewer: boolean;
  createdAt: string;
};

export type CommunityCommentReplyView = {
  id: string;
  commentId: string;
  userId: string;
  userName: string;
  userImage: string | null;
  text: string;
  createdAt: string;
};

export type CommunityCommentView = {
  id: string;
  messageId: string;
  userId: string;
  userName: string;
  userImage: string | null;
  text: string;
  createdAt: string;
  replies: CommunityCommentReplyView[];
};

export type CommunityMember = { id: string; name: string; profileImage: string | null };

export type CommunityFeed = {
  messages: CommunityMessageView[];
  mentionNames: Record<string, string>;
  hasMore: boolean;
};

type MessageRow = Prisma.CommunityMessageGetPayload<{ select: typeof MESSAGE_SELECT }>;
type CommentRow = Prisma.CommunityCommentGetPayload<{ select: typeof COMMENT_SELECT }>;
type ReplyRow = Prisma.CommunityCommentReplyGetPayload<{ select: typeof REPLY_SELECT }>;

const MESSAGE_SELECT = {
  id: true,
  type: true,
  authorId: true,
  title: true,
  text: true,
  pinned: true,
  listingType: true,
  rent: true,
  rentNegotiable: true,
  location: true,
  genderPreference: true,
  contactName: true,
  contactPhone: true,
  listingStatus: true,
  expiresAt: true,
  viewCount: true,
  likeCount: true,
  commentCount: true,
  createdAt: true,
  author: { select: { id: true, name: true, profileImage: true } },
  images: { select: { url: true }, orderBy: { sortOrder: 'asc' } }
} satisfies Prisma.CommunityMessageSelect;

const COMMENT_SELECT = {
  id: true,
  messageId: true,
  text: true,
  createdAt: true,
  user: { select: { id: true, name: true, profileImage: true } }
} satisfies Prisma.CommunityCommentSelect;

const REPLY_SELECT = {
  id: true,
  commentId: true,
  text: true,
  createdAt: true,
  user: { select: { id: true, name: true, profileImage: true } }
} satisfies Prisma.CommunityCommentReplySelect;

function visibleWhere(now: Date): Prisma.CommunityMessageWhereInput {
  return {
    deletedAt: null,
    isPublished: true,
    type: { not: COMMUNITY_MESSAGE_TYPES.WELCOME },
    NOT: {
      AND: [
        { type: COMMUNITY_MESSAGE_TYPES.TOLET },
        { OR: [{ listingStatus: { not: TOLET_STATUS.ACTIVE } }, { expiresAt: { lte: now } }] }
      ]
    }
  };
}

export function isSystemMessage(type: string): boolean {
  return type !== COMMUNITY_MESSAGE_TYPES.MEMBER && type !== COMMUNITY_MESSAGE_TYPES.TOLET;
}

export function isListingActive(row: { listingStatus: string | null; expiresAt: Date | null }): boolean {
  return row.listingStatus === TOLET_STATUS.ACTIVE && Boolean(row.expiresAt) && row.expiresAt!.getTime() > Date.now();
}

function effectiveListingStatus(row: MessageRow): string | null {
  if (row.type !== COMMUNITY_MESSAGE_TYPES.TOLET) return null;
  return isListingActive(row) ? TOLET_STATUS.ACTIVE : TOLET_STATUS.EXPIRED;
}

function serialize(row: MessageRow, likedByViewer: boolean): CommunityMessageView {
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
    images: row.images.map((image) => image.url),
    pinned: row.pinned,
    listingType: row.listingType,
    rent: row.rent,
    rentNegotiable: row.rentNegotiable,
    location: row.location,
    genderPreference: row.genderPreference,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    listingStatus: row.listingStatus,
    effectiveListingStatus: effectiveListingStatus(row),
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    viewCount: row.viewCount,
    likeCount: row.likeCount,
    commentCount: row.commentCount,
    likedByViewer,
    createdAt: row.createdAt.toISOString()
  };
}

function serializeComment(row: CommentRow, replies: ReplyRow[]): CommunityCommentView {
  return {
    id: row.id,
    messageId: row.messageId,
    userId: row.user.id,
    userName: row.user.name,
    userImage: row.user.profileImage,
    text: row.text,
    createdAt: row.createdAt.toISOString(),
    replies: replies.map(serializeReply)
  };
}

function serializeReply(row: ReplyRow): CommunityCommentReplyView {
  return {
    id: row.id,
    commentId: row.commentId,
    userId: row.user.id,
    userName: row.user.name,
    userImage: row.user.profileImage,
    text: row.text,
    createdAt: row.createdAt.toISOString()
  };
}

async function likedMessageIds(messageIds: string[], viewerId?: string | null): Promise<Set<string>> {
  if (!viewerId || messageIds.length === 0) return new Set();

  const likes = await prisma.communityLike.findMany({
    where: { messageId: { in: messageIds }, userId: viewerId },
    select: { messageId: true }
  });
  return new Set(likes.map((like) => like.messageId));
}

export function computeExpiresAt(days: number): Date {
  const safeDays = Math.max(1, Math.trunc(days));
  return new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000);
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

export async function readFeed(options: {
  before?: string;
  after?: string;
  limit?: number;
  viewerId?: string | null;
}): Promise<CommunityFeed> {
  const take = clampLimit(options.limit);
  const before = parseCursor(options.before);
  const after = parseCursor(options.after);
  const now = new Date();

  const where: Prisma.CommunityMessageWhereInput = {
    ...visibleWhere(now),
    ...(before ? { createdAt: { lt: before } } : {}),
    ...(after ? { createdAt: { gt: after } } : {})
  };

  const rows = await prisma.communityMessage.findMany({
    where,
    select: MESSAGE_SELECT,
    orderBy: { createdAt: 'desc' },
    take: take + 1
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  const liked = await likedMessageIds(page.map((row) => row.id), options.viewerId);
  const messages = page.map((row) => serialize(row, liked.has(row.id)));

  return {
    messages,
    mentionNames: await mentionNamesFor(messages),
    hasMore: after ? false : hasMore
  };
}

export type PostMessageToLetInput = {
  listingType: string;
  rent: number;
  rentNegotiable: boolean;
  location: string;
  genderPreference: string;
  contactName: string | null;
  contactPhone: string | null;
  expiryDays: number;
};

export async function postMessage(params: {
  authorId: string;
  text: string;
  images?: string[];
  title?: string | null;
  toLet?: PostMessageToLetInput;
}): Promise<CommunityMessageView> {
  const row = await prisma.communityMessage.create({
    data: {
      key: `${MEMBER_KEY_PREFIX}${randomUUID()}`,
      type: params.toLet ? COMMUNITY_MESSAGE_TYPES.TOLET : COMMUNITY_MESSAGE_TYPES.MEMBER,
      authorId: params.authorId,
      title: params.title ?? null,
      text: params.text,
      publishedAt: new Date(),
      createdById: params.authorId,
      updatedById: params.authorId,
      ...(params.toLet
        ? {
            listingType: params.toLet.listingType,
            rent: params.toLet.rent,
            rentNegotiable: params.toLet.rentNegotiable,
            location: params.toLet.location,
            genderPreference: params.toLet.genderPreference,
            contactName: params.toLet.contactName,
            contactPhone: params.toLet.contactPhone,
            listingStatus: TOLET_STATUS.ACTIVE,
            expiresAt: computeExpiresAt(params.toLet.expiryDays)
          }
        : {}),
      images: params.images?.length
        ? {
            create: params.images.map((url, index) => ({
              url,
              sortOrder: index,
              createdById: params.authorId,
              updatedById: params.authorId
            }))
          }
        : undefined
    },
    select: MESSAGE_SELECT
  });

  return serialize(row, false);
}

export type UpdateListingInput = Partial<{
  listingType: string;
  title: string;
  text: string;
  rent: number;
  rentNegotiable: boolean;
  location: string;
  genderPreference: string;
  contactName: string | null;
  contactPhone: string | null;
  listingStatus: string;
  expiresAt: Date;
  images: string[];
}>;

export async function updateListing(id: string, input: UpdateListingInput, actorId: string): Promise<CommunityMessageView> {
  const { images, ...fields } = input;

  const row = await prisma.$transaction(async (tx) => {
    if (images) {
      await tx.communityMessageImage.deleteMany({ where: { messageId: id } });
      if (images.length > 0) {
        await tx.communityMessageImage.createMany({
          data: images.map((url, index) => ({
            messageId: id,
            url,
            sortOrder: index,
            createdById: actorId,
            updatedById: actorId
          }))
        });
      }
    }

    return tx.communityMessage.update({
      where: { id },
      data: { ...fields, updatedById: actorId },
      select: MESSAGE_SELECT
    });
  });

  const liked = await likedMessageIds([row.id], actorId);
  return serialize(row, liked.has(row.id));
}

export async function markListingExpired(id: string, actorId: string): Promise<void> {
  await prisma.communityMessage.update({
    where: { id },
    data: { listingStatus: TOLET_STATUS.EXPIRED, updatedById: actorId }
  });
}

export async function incrementView(id: string): Promise<void> {
  await prisma.communityMessage
    .update({ where: { id }, data: { viewCount: { increment: 1 } } })
    .catch(() => undefined);
}

export async function myListings(userId: string): Promise<CommunityMessageView[]> {
  const rows = await prisma.communityMessage.findMany({
    where: { authorId: userId, type: COMMUNITY_MESSAGE_TYPES.TOLET, deletedAt: null },
    select: MESSAGE_SELECT,
    orderBy: { createdAt: 'desc' }
  });
  return rows.map((row) => serialize(row, false));
}

export async function getMessageForView(id: string, viewerId?: string | null): Promise<CommunityMessageView | null> {
  const row = await prisma.communityMessage.findFirst({ where: { id, deletedAt: null }, select: MESSAGE_SELECT });
  if (!row) return null;

  const liked = await likedMessageIds([row.id], viewerId);
  return serialize(row, liked.has(row.id));
}

export async function deleteMessage(id: string): Promise<void> {
  await prisma.communityMessage.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function findMessage(id: string) {
  return prisma.communityMessage.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, authorId: true, type: true, title: true }
  });
}

export async function toggleLike(messageId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
  const existing = await prisma.communityLike.findUnique({
    where: { messageId_userId: { messageId, userId } },
    select: { id: true }
  });

  if (existing) {
    const [, message] = await prisma.$transaction([
      prisma.communityLike.delete({ where: { id: existing.id } }),
      prisma.communityMessage.update({
        where: { id: messageId },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true }
      })
    ]);
    return { liked: false, likeCount: Math.max(0, message.likeCount) };
  }

  const [, message] = await prisma.$transaction([
    prisma.communityLike.create({ data: { messageId, userId } }),
    prisma.communityMessage.update({
      where: { id: messageId },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true }
    })
  ]);
  return { liked: true, likeCount: message.likeCount };
}

export async function listComments(messageId: string): Promise<CommunityCommentView[]> {
  const comments = await prisma.communityComment.findMany({
    where: { messageId, deletedAt: null },
    select: COMMENT_SELECT,
    orderBy: { createdAt: 'asc' }
  });
  if (comments.length === 0) return [];

  const replies = await prisma.communityCommentReply.findMany({
    where: { commentId: { in: comments.map((comment) => comment.id) }, deletedAt: null },
    select: REPLY_SELECT,
    orderBy: { createdAt: 'asc' }
  });

  const repliesByComment = new Map<string, ReplyRow[]>();
  for (const reply of replies) {
    const list = repliesByComment.get(reply.commentId) ?? [];
    list.push(reply);
    repliesByComment.set(reply.commentId, list);
  }

  return comments.map((comment) => serializeComment(comment, repliesByComment.get(comment.id) ?? []));
}

export async function addComment(params: { messageId: string; userId: string; text: string }): Promise<CommunityCommentView> {
  const [row] = await prisma.$transaction([
    prisma.communityComment.create({
      data: {
        messageId: params.messageId,
        userId: params.userId,
        text: params.text,
        createdById: params.userId,
        updatedById: params.userId
      },
      select: COMMENT_SELECT
    }),
    prisma.communityMessage.update({ where: { id: params.messageId }, data: { commentCount: { increment: 1 } } })
  ]);

  return serializeComment(row, []);
}

export async function findComment(id: string) {
  return prisma.communityComment.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, userId: true, messageId: true }
  });
}

export async function deleteComment(id: string, messageId: string, actorId: string): Promise<void> {
  await prisma.$transaction([
    prisma.communityComment.update({ where: { id }, data: { deletedAt: new Date(), updatedById: actorId } }),
    prisma.communityMessage.update({ where: { id: messageId }, data: { commentCount: { decrement: 1 } } })
  ]);
}

export async function addReply(params: { commentId: string; userId: string; text: string }): Promise<CommunityCommentReplyView> {
  const row = await prisma.communityCommentReply.create({
    data: {
      commentId: params.commentId,
      userId: params.userId,
      text: params.text,
      createdById: params.userId,
      updatedById: params.userId
    },
    select: REPLY_SELECT
  });

  return serializeReply(row);
}

export async function findReply(id: string) {
  return prisma.communityCommentReply.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, userId: true, commentId: true }
  });
}

export async function deleteReply(id: string, actorId: string): Promise<void> {
  await prisma.communityCommentReply.update({ where: { id }, data: { deletedAt: new Date(), updatedById: actorId } });
}

export async function notifyNewComment(params: {
  message: { id: string; authorId: string | null; title: string | null; type: string };
  commenterId: string;
  text: string;
}): Promise<void> {
  if (!params.message.authorId || params.message.authorId === params.commenterId) return;

  try {
    const title =
      params.message.type === COMMUNITY_MESSAGE_TYPES.TOLET && params.message.title
        ? strings.community.comments.notificationTitleListing(params.message.title)
        : strings.community.comments.notificationTitlePost;

    await createNotifications([params.message.authorId], {
      type: NOTIFICATION_TYPES.COMMUNITY_COMMENT,
      title,
      excerpt: params.text,
      link:
        params.message.type === COMMUNITY_MESSAGE_TYPES.TOLET
          ? toLetListingPath(params.message.id)
          : ROUTES.community,
      actorId: params.commenterId
    });
  } catch {
    return;
  }
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
    if (!(await isNotificationEnabled(NOTIFICATION_TYPES.MENTION_COMMUNITY))) return;

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
      ...visibleWhere(new Date()),
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
    where: { status: USER_STATUS.APPROVED, role: { not: USER_ROLES.ADMIN } },
    select: { id: true, name: true, profileImage: true },
    orderBy: { name: 'asc' },
    take: communityConfig.directorySize
  });

  return users;
}
