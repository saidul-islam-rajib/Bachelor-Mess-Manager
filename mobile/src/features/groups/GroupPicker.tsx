import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { en } from '@/core/i18n/en';
import { useGroup } from '@/core/providers/group';
import { theme } from '@/core/theme';

export function GroupPicker() {
  const { groups, active, select } = useGroup();
  const [open, setOpen] = useState(false);
  if (groups.length < 2 || !active) return null;

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={en.group.pick} onPress={() => setOpen(true)}>
        <Text style={styles.trigger}>{active.name}</Text>
      </Pressable>
      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.heading}>{en.group.pick}</Text>
            {groups.map((g) => (
              <Pressable
                key={g.id}
                accessibilityRole="button"
                style={styles.row}
                onPress={() => {
                  select(g.id);
                  setOpen(false);
                }}
              >
                <Text style={g.id === active.id ? styles.selected : styles.item}>{g.name}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { color: theme.colors.primary, fontSize: 16, marginRight: theme.spacing.md },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: theme.spacing.lg },
  sheet: { backgroundColor: theme.colors.background, borderRadius: theme.radius, padding: theme.spacing.md },
  heading: { fontSize: 18, fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing.sm },
  row: { paddingVertical: theme.spacing.md },
  item: { color: theme.colors.text, fontSize: 16 },
  selected: { color: theme.colors.primary, fontSize: 16, fontWeight: '600' },
});
