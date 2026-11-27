import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { en, t } from '@/core/i18n/en';
import { useAuth } from '@/core/providers/auth';
import { theme } from '@/core/theme';

export function MoreScreen() {
  const { user, signOut } = useAuth();
  return (
    <View style={styles.screen}>
      <Text style={styles.text}>{t(en.more.signedInAs, { name: user?.name ?? '' })}</Text>
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
