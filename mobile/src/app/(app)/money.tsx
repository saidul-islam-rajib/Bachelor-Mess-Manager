import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { en } from '@/core/i18n/en';
import { theme } from '@/core/theme';
import { BazarScreen } from '@/features/bazar/BazarScreen';
import { BillsScreen } from '@/features/bills/BillsScreen';

export default function MoneyTab() {
  const [section, setSection] = useState<'bazar' | 'bills'>('bazar');
  return (
    <View style={styles.screen}>
      <View style={styles.row}>
        {(['bazar', 'bills'] as const).map((k) => (
          <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: section === k }} style={[styles.button, section === k && styles.on]} onPress={() => setSection(k)}>
            <Text style={section === k ? styles.onText : styles.text}>{k === 'bazar' ? en.bills.sectionBazar : en.bills.sectionBills}</Text>
          </Pressable>
        ))}
      </View>
      {section === 'bazar' ? <BazarScreen /> : <BillsScreen />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  row: { flexDirection: 'row', gap: theme.spacing.sm, padding: theme.spacing.md },
  button: { flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, paddingVertical: 8, alignItems: 'center' },
  on: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  text: { color: theme.colors.text },
  onText: { color: theme.colors.primaryText, fontWeight: '600' },
});
