import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { en, t } from '@/core/i18n/en';
import { theme } from '@/core/theme';
import { fetchPlan, fetchSummary } from './api';

const money = (v: number) => v.toFixed(2);

function Plan({ groupId }: { groupId: string }) {
  const query = useQuery({ queryKey: ['meal-plan', groupId], queryFn: () => fetchPlan(groupId) });
  const plan = query.data?.plan;
  if (query.isError) return <Text style={styles.error}>{en.insights.planFailed}</Text>;
  if (!plan || !plan.isActive) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{en.insights.plan}</Text>
      {plan.days.map((d) => (
        <View key={d.weekday} style={styles.line}>
          <Text style={styles.text}>{en.insights.weekdays[d.weekday] ?? ''}</Text>
          <Text style={styles.muted}>
            {d.enabled ? `${d.breakfast} · ${d.lunch} · ${d.dinner}` : en.insights.off}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Summary({ groupId, month }: { groupId: string; month: string }) {
  const query = useQuery({ queryKey: ['meal-summary', groupId, month], queryFn: () => fetchSummary(groupId, month) });
  const data = query.data;
  if (query.isError) return <Text style={styles.error}>{en.insights.summaryFailed}</Text>;
  if (!data) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{en.insights.summary}</Text>
      <View style={styles.line}>
        <Text style={styles.text}>{en.insights.mealRate}</Text>
        <Text style={styles.text}>{money(data.totals.mealRate)}</Text>
      </View>
      <View style={styles.line}>
        <Text style={styles.text}>{en.insights.totalMeals}</Text>
        <Text style={styles.text}>{data.totals.meals}</Text>
      </View>
      <View style={styles.line}>
        <Text style={styles.text}>{en.insights.totalExpense}</Text>
        <Text style={styles.text}>{money(data.totals.expense)}</Text>
      </View>
      <Text style={styles.muted}>{t(en.insights.through, { date: data.through })}</Text>
      {data.members.map((m) => (
        <View key={m.id} style={styles.line}>
          <Text style={styles.text}>{m.name}</Text>
          <Text style={styles.muted}>{t(en.insights.member, { meals: String(m.meals), cost: money(m.cost) })}</Text>
        </View>
      ))}
    </View>
  );
}

export function MealInsights({ groupId, month }: { groupId: string; month: string }) {
  return (
    <View style={styles.wrap}>
      <Summary groupId={groupId} month={month} />
      <Plan groupId={groupId} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.spacing.md },
  section: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, padding: theme.spacing.md, gap: 6 },
  heading: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
  line: { flexDirection: 'row', justifyContent: 'space-between' },
  text: { color: theme.colors.text },
  muted: { color: theme.colors.muted },
  error: { color: theme.colors.error },
});
