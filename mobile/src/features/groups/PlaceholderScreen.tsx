import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/core/theme';

export function PlaceholderScreen({ message }: { message: string }) {
  return (
    <View style={styles.screen}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing.lg },
  text: { color: theme.colors.muted, fontSize: 16 },
});
