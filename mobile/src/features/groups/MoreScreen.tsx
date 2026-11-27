import React from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { en, t } from '@/core/i18n/en';
import { useAuth } from '@/core/providers/auth';
import { theme } from '@/core/theme';
import { useUnreadCount } from '@/features/notifications/hooks';

export function MoreScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const unread = useUnreadCount();
  return (
    <View style={styles.screen}>
      <Text style={styles.text}>{t(en.more.signedInAs, { name: user?.name ?? '' })}</Text>
      <Pressable accessibilityRole="button" style={styles.button} onPress={() => router.push('/(app)/notifications')}>
        <Text style={styles.buttonText}>
          {unread > 0 ? `${en.more.notifications} (${unread})` : en.more.notifications}
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button" style={styles.button} onPress={() => void signOut()}>
        <Text style={styles.buttonText}>{en.more.signOut}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing.lg, gap: theme.spacing.md },
  text: { color: theme.colors.text, fontSize: 16 },
  button: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, padding: theme.spacing.md, alignItems: 'center' },
  buttonText: { color: theme.colors.text },
});
