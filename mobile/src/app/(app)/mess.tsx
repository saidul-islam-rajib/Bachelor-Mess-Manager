import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { en } from '@/core/i18n/en';
import { theme } from '@/core/theme';
import { MembersScreen } from '@/features/members/MembersScreen';
import { SettlementScreen } from '@/features/settlement/SettlementScreen';

export default function MessTab() {
  const [section, setSection] = useState<'members' | 'settlement'>('members');
  return (
    <View style={styles.screen}>
      <View style={styles.row}>
        {(['members', 'settlement'] as const).map((k) => (
          <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: section === k }} style={[styles.button, section === k && styles.on]} onPress={() => setSection(k)}>
            <Text style={section === k ? styles.onText : styles.text}>{k === 'members' ? en.members.sectionMembers : en.settlement.sectionSettlement}</Text>
          </Pressable>
        ))}
      </View>
      {section === 'members' ? <MembersScreen /> : <SettlementScreen />}
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
