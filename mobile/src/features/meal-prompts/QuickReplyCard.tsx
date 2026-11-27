import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/core/api/client';
import { en, t } from '@/core/i18n/en';
import { theme } from '@/core/theme';
import { answerPrompt, fetchPrompts } from './api';
import type { Counts, PromptCardData } from './schemas';

const KINDS = ['breakfast', 'lunch', 'dinner'] as const;

const describe = (c: Counts) => KINDS.map((k) => `${en.meals.kinds[k]} ${c[k]}`).join(' · ');

function PromptCard({ card }: { card: PromptCardData }) {
  const client = useQueryClient();
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState<Counts>(card.counts);
  const [notice, setNotice] = useState<string | null>(null);

  const answer = useMutation({
    mutationFn: (v: { answer: 'YES' | 'NO' | 'CUSTOM'; counts?: Counts }) =>
      answerPrompt(card.groupId, card.date, v.answer, v.counts),
    onSuccess: (res) => {
      setNotice(res.summary);
      setCustom(false);
      void client.invalidateQueries({ queryKey: ['meal-prompts'] });
      void client.invalidateQueries({ queryKey: ['meals', card.groupId] });
    },
    onError: (e) => setNotice(e instanceof ApiError ? e.message : en.prompts.failed),
  });

  const busy = answer.isPending;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t(en.prompts.title, { group: card.groupName, date: card.date })}</Text>
      <Text style={styles.muted}>{t(en.prompts.planned, { meals: describe(card.planned) })}</Text>
      {card.answer ? <Text style={styles.muted}>{t(en.prompts.current, { meals: describe(card.counts) })}</Text> : null}

      {custom ? (
        <View style={styles.row}>
          {KINDS.map((k) => (
            <View key={k} style={styles.stepper}>
              <Text style={styles.muted}>{en.meals.kinds[k]}</Text>
              <View style={styles.row}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(en.meals.decrease, { kind: en.meals.kinds[k] })}
                  disabled={draft[k] <= 0}
                  style={styles.step}
                  onPress={() => setDraft({ ...draft, [k]: draft[k] - 1 })}
                >
                  <Text style={styles.stepText}>−</Text>
                </Pressable>
                <Text style={styles.count}>{draft[k]}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(en.meals.increase, { kind: en.meals.kinds[k] })}
                  disabled={draft[k] >= 9}
                  style={styles.step}
                  onPress={() => setDraft({ ...draft, [k]: draft[k] + 1 })}
                >
                  <Text style={styles.stepText}>+</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.row}>
        {custom ? (
          <Pressable accessibilityRole="button" disabled={busy} style={styles.primary} onPress={() => answer.mutate({ answer: 'CUSTOM', counts: draft })}>
            <Text style={styles.primaryText}>{en.prompts.saveCustom}</Text>
          </Pressable>
        ) : (
          <>
            <Pressable accessibilityRole="button" disabled={busy} style={styles.primary} onPress={() => answer.mutate({ answer: 'YES' })}>
              <Text style={styles.primaryText}>{en.prompts.yes}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={busy} style={styles.button} onPress={() => answer.mutate({ answer: 'NO' })}>
              <Text style={styles.buttonText}>{en.prompts.no}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={busy} style={styles.button} onPress={() => setCustom(true)}>
              <Text style={styles.buttonText}>{en.prompts.custom}</Text>
            </Pressable>
          </>
        )}
      </View>
      {notice ? <Text style={styles.muted}>{notice}</Text> : null}
    </View>
  );
}

export function QuickReplyCard() {
  const query = useQuery({ queryKey: ['meal-prompts'], queryFn: fetchPrompts });
  const prompts = query.data?.prompts ?? [];
  if (query.isError) return <Text style={styles.error}>{en.prompts.loadFailed}</Text>;
  if (prompts.length === 0) return null;
  return (
    <View style={styles.list}>
      {prompts.map((p) => (
        <PromptCard key={p.groupId} card={p} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: theme.spacing.sm },
  card: { borderWidth: 1, borderColor: theme.colors.primary, borderRadius: theme.radius, padding: theme.spacing.md, gap: theme.spacing.sm },
  title: { fontWeight: '600', color: theme.colors.text },
  muted: { color: theme.colors.muted },
  error: { color: theme.colors.error },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' },
  stepper: { alignItems: 'center', gap: 4 },
  step: { width: 36, height: 36, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 20, color: theme.colors.text },
  count: { minWidth: 20, textAlign: 'center', fontSize: 18, color: theme.colors.text },
  primary: { backgroundColor: theme.colors.primary, borderRadius: theme.radius, paddingVertical: 8, paddingHorizontal: theme.spacing.md },
  primaryText: { color: theme.colors.primaryText, fontWeight: '600' },
  button: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, paddingVertical: 8, paddingHorizontal: theme.spacing.md },
  buttonText: { color: theme.colors.text },
});
