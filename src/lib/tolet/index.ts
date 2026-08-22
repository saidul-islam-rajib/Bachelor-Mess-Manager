import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { toLetConfig } from '@/config';
import { NOTIFICATION_TYPES, TOLET_STATUS } from '@/lib/constants';
import { strings } from '@/lib/i18n';
import { createNotifications } from '@/lib/notifications';
import { toLetListingPath } from '@/lib/routes';
import { paginate, type Paginated } from '@/lib/query';

export type ToLetListingView = {
  id: string;
  authorId: string;
  authorName: string;
  authorImage: string | null;
  type: string;
  title: string;
  description: string;
  rent: number;
  rentNegotiable: boolean;
  location: string;
  genderPreference: string;
  availableFrom: string | null;
  contactName: string | null;
  contactPhone: string | null;
  status: string;
  effectiveStatus: string;
  expiresAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  images: string[];
  likedByViewer: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ToLetCommentView = {
  id: string;
  listingId: string;
  userId: string;
  userName: string;
  userImage: string | null;
  text: string;
  createdAt: string;
};

type ListingRow = Prisma.ToLetListingGetPayload<{ select: typeof LISTING_SELECT }>;
type CommentRow = Prisma.ToLetCommentGetPayload<{ select: typeof COMMENT_SELECT }>;

const LISTING_SELECT = {
  id: true,
  authorId: true,
  type: true,
  title: true,
  description: true,
  rent: true,
  rentNegotiable: true,
  location: true,
  genderPreference: true,
  availableFrom: true,
  contactName: true,
  contactPhone: true,
  status: true,
  expiresAt: true,
  viewCount: true,
  likeCount: true,
  commentCount: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true, profileImage: true } },
  images: { select: { url: true }, orderBy: { sortOrder: 'asc' } }
} satisfies Prisma.ToLetListingSelect;

const COMMENT_SELECT = {
  id: true,
  listingId: true,
  text: true,
  createdAt: true,
  user: { select: { id: true, name: true, profileImage: true } }
} satisfies Prisma.ToLetCommentSelect;

export function isListingActive(row: { status: string; expiresAt: Date }): boolean {
  return row.status === TOLET_STATUS.ACTIVE && row.expiresAt.getTime() > Date.now();
}

function effectiveStatus(row: { status: string; expiresAt: Date }): string {
  return isListingActive(row) ? TOLET_STATUS.ACTIVE : TOLET_STATUS.EXPIRED;
}

function serialize(row: ListingRow, likedByViewer: boolean): ToLetListingView {
  return {
    id: row.id,
    authorId: row.author.id,
    authorName: row.author.name,
    authorImage: row.author.profileImage,
    type: row.type,
    title: row.title,
    description: row.description,
    rent: row.rent,
    rentNegotiable: row.rentNegotiable,
    location: row.location,
    genderPreference: row.genderPreference,
    availableFrom: row.availableFrom ? row.availableFrom.toISOString() : null,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    status: row.status,
    effectiveStatus: effectiveStatus(row),
    expiresAt: row.expiresAt.toISOString(),
    viewCount: row.viewCount,
    likeCount: row.likeCount,
    commentCount: row.commentCount,
    images: row.images.map((image) => image.url),
    likedByViewer,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function serializeComment(row: CommentRow): ToLetCommentView {
  return {
    id: row.id,
    listingId: row.listingId,
    userId: row.user.id,
    userName: row.user.name,
    userImage: row.user.profileImage,
    text: row.text,
    createdAt: row.createdAt.toISOString()
  };
}

async function likedListingIds(listingIds: string[], viewerId?: string | null): Promise<Set<string>> {
  if (!viewerId || listingIds.length === 0) return new Set();

  const likes = await prisma.toLetLike.findMany({
    where: { listingId: { in: listingIds }, userId: viewerId },
    select: { listingId: true }
  });
  return new Set(likes.map((like) => like.listingId));
}

export function computeExpiresAt(days: number): Date {
  const safeDays = Math.max(1, Math.trunc(days));
  return new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000);
}

export async function searchListings(options: {
  q?: string;
  type?: string;
  minRent?: number;
  maxRent?: number;
  page?: number;
  pageSize?: number;
  viewerId?: string | null;
}): Promise<Paginated<ToLetListingView>> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(Math.max(1, options.pageSize ?? toLetConfig.pageSize), toLetConfig.pageSize);

  const rentFilter: Prisma.FloatFilter = {};
  if (options.minRent !== undefined) rentFilter.gte = options.minRent;
  if (options.maxRent !== undefined) rentFilter.lte = options.maxRent;

  const where: Prisma.ToLetListingWhereInput = {
    deletedAt: null,
    status: TOLET_STATUS.ACTIVE,
    expiresAt: { gt: new Date() },
    ...(options.type ? { type: options.type } : {}),
    ...(Object.keys(rentFilter).length > 0 ? { rent: rentFilter } : {}),
    ...(options.q
      ? {
          OR: [
            { title: { contains: options.q, mode: 'insensitive' } },
            { description: { contains: options.q, mode: 'insensitive' } },
            { location: { contains: options.q, mode: 'insensitive' } },
            { author: { name: { contains: options.q, mode: 'insensitive' } } }
          ]
        }
      : {})
  };

  const [rows, total] = await Promise.all([
    prisma.toLetListing.findMany({
      where,
      select: LISTING_SELECT,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.toLetListing.count({ where })
  ]);

  const liked = await likedListingIds(rows.map((row) => row.id), options.viewerId);
  const items = rows.map((row) => serialize(row, liked.has(row.id)));

  return paginate(items, page, pageSize, total);
}

export async function myListings(userId: string): Promise<ToLetListingView[]> {
  const rows = await prisma.toLetListing.findMany({
    where: { authorId: userId, deletedAt: null },
    select: LISTING_SELECT,
    orderBy: { createdAt: 'desc' }
  });
  return rows.map((row) => serialize(row, false));
}

export async function findListing(id: string) {
  return prisma.toLetListing.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, authorId: true, title: true, status: true, expiresAt: true }
  });
}

export async function getListingForView(id: string, viewerId?: string | null): Promise<ToLetListingView | null> {
  const row = await prisma.toLetListing.findFirst({ where: { id, deletedAt: null }, select: LISTING_SELECT });
  if (!row) return null;

  const liked = await likedListingIds([row.id], viewerId);
  return serialize(row, liked.has(row.id));
}

export async function incrementView(id: string): Promise<void> {
  await prisma.toLetListing.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => undefined);
}

export type CreateListingInput = {
  authorId: string;
  type: string;
  title: string;
  description: string;
  rent: number;
  rentNegotiable: boolean;
  location: string;
  genderPreference: string;
  availableFrom: Date | null;
  contactName: string | null;
  contactPhone: string | null;
  expiresAt: Date;
  images: string[];
};

export async function createListing(input: CreateListingInput): Promise<ToLetListingView> {
  const row = await prisma.toLetListing.create({
    data: {
      authorId: input.authorId,
      type: input.type,
      title: input.title,
      description: input.description,
      rent: input.rent,
      rentNegotiable: input.rentNegotiable,
      location: input.location,
      genderPreference: input.genderPreference,
      availableFrom: input.availableFrom,
      contactName: input.contactName,
      contactPhone: input.contactPhone,
      expiresAt: input.expiresAt,
      createdById: input.authorId,
      updatedById: input.authorId,
      publishedAt: new Date(),
      images: input.images.length
        ? {
            create: input.images.map((url, index) => ({
              url,
              sortOrder: index,
              createdById: input.authorId,
              updatedById: input.authorId
            }))
          }
        : undefined
    },
    select: LISTING_SELECT
  });

  return serialize(row, false);
}

export type UpdateListingInput = Partial<{
  type: string;
  title: string;
  description: string;
  rent: number;
  rentNegotiable: boolean;
  location: string;
  genderPreference: string;
  availableFrom: Date | null;
  contactName: string | null;
  contactPhone: string | null;
  status: string;
  expiresAt: Date;
  images: string[];
}>;

export async function updateListing(id: string, input: UpdateListingInput, actorId: string): Promise<ToLetListingView> {
  const { images, ...fields } = input;

  const row = await prisma.$transaction(async (tx) => {
    if (images) {
      await tx.toLetImage.deleteMany({ where: { listingId: id } });
      if (images.length > 0) {
        await tx.toLetImage.createMany({
          data: images.map((url, index) => ({
            listingId: id,
            url,
            sortOrder: index,
            createdById: actorId,
            updatedById: actorId
          }))
        });
      }
    }

    return tx.toLetListing.update({
      where: { id },
      data: { ...fields, updatedById: actorId },
      select: LISTING_SELECT
    });
  });

  return serialize(row, false);
}

export async function markExpired(id: string, actorId: string): Promise<void> {
  await prisma.toLetListing.update({
    where: { id },
    data: { status: TOLET_STATUS.EXPIRED, updatedById: actorId }
  });
}

export async function deleteListing(id: string, actorId: string): Promise<void> {
  await prisma.toLetListing.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: actorId }
  });
}

export async function toggleLike(listingId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
  const existing = await prisma.toLetLike.findUnique({
    where: { listingId_userId: { listingId, userId } },
    select: { id: true }
  });

  if (existing) {
    const [, listing] = await prisma.$transaction([
      prisma.toLetLike.delete({ where: { id: existing.id } }),
      prisma.toLetListing.update({
        where: { id: listingId },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true }
      })
    ]);
    return { liked: false, likeCount: Math.max(0, listing.likeCount) };
  }

  const [, listing] = await prisma.$transaction([
    prisma.toLetLike.create({ data: { listingId, userId } }),
    prisma.toLetListing.update({
      where: { id: listingId },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true }
    })
  ]);
  return { liked: true, likeCount: listing.likeCount };
}

export async function listComments(listingId: string): Promise<ToLetCommentView[]> {
  const rows = await prisma.toLetComment.findMany({
    where: { listingId, deletedAt: null },
    select: COMMENT_SELECT,
    orderBy: { createdAt: 'asc' }
  });
  return rows.map(serializeComment);
}

export async function addComment(params: { listingId: string; userId: string; text: string }): Promise<ToLetCommentView> {
  const [row] = await prisma.$transaction([
    prisma.toLetComment.create({
      data: {
        listingId: params.listingId,
        userId: params.userId,
        text: params.text,
        createdById: params.userId,
        updatedById: params.userId
      },
      select: COMMENT_SELECT
    }),
    prisma.toLetListing.update({ where: { id: params.listingId }, data: { commentCount: { increment: 1 } } })
  ]);

  return serializeComment(row);
}

export async function findComment(id: string) {
  return prisma.toLetComment.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, userId: true, listingId: true }
  });
}

export async function deleteComment(id: string, listingId: string, actorId: string): Promise<void> {
  await prisma.$transaction([
    prisma.toLetComment.update({ where: { id }, data: { deletedAt: new Date(), updatedById: actorId } }),
    prisma.toLetListing.update({ where: { id: listingId }, data: { commentCount: { decrement: 1 } } })
  ]);
}

export async function notifyNewComment(params: {
  listing: { id: string; authorId: string; title: string };
  commenterId: string;
  text: string;
}): Promise<void> {
  if (params.listing.authorId === params.commenterId) return;

  try {
    await createNotifications([params.listing.authorId], {
      type: NOTIFICATION_TYPES.TOLET_COMMENT,
      title: strings.toLet.comments.notificationTitle(params.listing.title),
      excerpt: params.text,
      link: toLetListingPath(params.listing.id),
      actorId: params.commenterId
    });
  } catch {
    return;
  }
}
