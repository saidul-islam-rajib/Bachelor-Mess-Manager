import { strings } from '@/lib/i18n';

export type Announcement = {
  key: string;
  title: string;
  body: string;
};

export const ANNOUNCEMENTS: Announcement[] = [
  { key: 'community-room-v1', ...strings.community.announcements.communityRoom },
  { key: 'meal-quick-reply-v1', ...strings.community.announcements.mealQuickReply }
];
