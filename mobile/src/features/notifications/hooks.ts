import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/core/providers/auth';
import { fetchNotifications, NOTIFICATIONS_KEY } from './api';

export function useNotifications() {
  const { user } = useAuth();
  const query = useQuery({ queryKey: NOTIFICATIONS_KEY, queryFn: fetchNotifications, enabled: !!user });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      if (user) void refetch();
    }, [user, refetch]),
  );
  return query;
}

export function useUnreadCount(): number {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: fetchNotifications,
    enabled: !!user,
    refetchInterval: 60000,
  });
  return query.data?.unreadCount ?? 0;
}
