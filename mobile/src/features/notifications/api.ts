import { request } from '@/core/api/client';
import { notificationFeed, notificationRead } from './schemas';

export const NOTIFICATIONS_KEY = ['notifications'] as const;

export const fetchNotifications = () => request('/api/notifications', notificationFeed);

export const markAllRead = () => request('/api/notifications', notificationFeed, { method: 'PATCH' });

export const markRead = (id: string) =>
  request(`/api/notifications/${id}`, notificationRead, { method: 'PATCH' });
