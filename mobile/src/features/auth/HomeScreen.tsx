import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { en, t } from '@/core/i18n/en';
import { useAuth } from '@/core/providers/auth';
import { theme } from '@/core/theme';

export function HomeScreen() {
  const { user, signOut } = useAuth();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t(en.home.welcome, { name: user?.name ?? '' })}</Text>
      <Pressable accessibilityRole="button" style={styles.button} onPress={() => void signOut()}>
        <Text style={styles.buttonText}>{en.home.signOut}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: theme.spacing.lg, backgroundColor: theme.colors.background },
  title: { fontSize: 22, fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing.lg },
  button: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, padding: theme.spacing.md, alignItems: 'center' },
  buttonText: { color: theme.colors.text },
});
