import React from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { en, t } from '@/core/i18n/en';
import { theme } from '@/core/theme';
import { markAllRead, markRead, NOTIFICATIONS_KEY } from './api';
import { useNotifications } from './hooks';
import type { NotificationFeed, NotificationItem } from './schemas';

export function NotificationsScreen() {
  const client = useQueryClient();
  const query = useNotifications();

  const readOne = useMutation({
    mutationFn: markRead,
    onSuccess: (_, id) => {
      client.setQueryData<NotificationFeed>(NOTIFICATIONS_KEY, (old) => {
        if (!old) return old;
        const target = old.notifications.find((n) => n.id === id);
        const wasUnread = target ? !target.read : false;
        return {
          ...old,
          unreadCount: Math.max(0, old.unreadCount - (wasUnread ? 1 : 0)),
          notifications: old.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        };
      });
    },
  });

  const readAll = useMutation({
    mutationFn: markAllRead,
    onSuccess: (feed) => client.setQueryData(NOTIFICATIONS_KEY, feed),
  });

  if (query.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (query.isError || !query.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{en.notifications.loadFailed}</Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => void query.refetch()}>
          <Text style={styles.buttonText}>{en.notifications.retry}</Text>
        </Pressable>
      </View>
    );
  }

  const { notifications, unreadCount } = query.data;
  const renderItem = ({ item }: { item: NotificationItem }) => (
    <Pressable
      accessibilityRole="button"
      style={[styles.row, !item.read && styles.unread]}
      onPress={() => {
        if (!item.read) readOne.mutate(item.id);
      }}
    >
      <Text style={styles.title}>{item.title ?? item.actorName}</Text>
      <Text style={styles.excerpt}>{item.excerpt}</Text>
      <Text style={styles.meta}>
        {[item.groupName, item.createdAt.slice(0, 10)].filter(Boolean).join(' · ')}
      </Text>
    </Pressable>
  );

  return (
    <FlatList
      style={styles.list}
      data={notifications}
      keyExtractor={(n) => n.id}
      renderItem={renderItem}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.count}>{t(en.notifications.unread, { count: String(unreadCount) })}</Text>
          {unreadCount > 0 ? (
            <Pressable accessibilityRole="button" disabled={readAll.isPending} onPress={() => readAll.mutate()}>
              <Text style={styles.link}>{en.notifications.markAll}</Text>
            </Pressable>
          ) : null}
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>{en.notifications.empty}</Text>}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md, padding: theme.spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: theme.spacing.md },
  count: { color: theme.colors.muted },
  link: { color: theme.colors.primary },
  row: { padding: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border, gap: 4 },
  unread: { backgroundColor: '#eff6ff' },
  title: { color: theme.colors.text, fontWeight: '600', fontSize: 16 },
  excerpt: { color: theme.colors.text },
  meta: { color: theme.colors.muted, fontSize: 12 },
  empty: { color: theme.colors.muted, textAlign: 'center', padding: theme.spacing.lg },
  error: { color: theme.colors.error },
  button: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, padding: theme.spacing.md },
  buttonText: { color: theme.colors.text },
});
