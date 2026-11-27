import { z } from 'zod';

export const notificationItem = z.object({
  id: z.string(),
  type: z.string(),
  actorId: z.string().nullable(),
  actorName: z.string(),
  groupId: z.string().nullable(),
  groupName: z.string().nullable(),
  title: z.string().nullable(),
  excerpt: z.string(),
  link: z.string(),
  read: z.boolean(),
  createdAt: z.string(),
});

export const notificationFeed = z.object({
  notifications: z.array(notificationItem),
  unreadCount: z.number(),
  meta: z.object({ page: z.number(), total: z.number(), hasNext: z.boolean() }).passthrough(),
});

export const notificationRead = z.object({ id: z.string() });

export type NotificationItem = z.infer<typeof notificationItem>;
export type NotificationFeed = z.infer<typeof notificationFeed>;
